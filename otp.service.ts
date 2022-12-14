import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addSeconds } from 'date-fns';
import { TwilioService } from 'nestjs-twilio';
import { authenticator, hotp } from 'otplib';
import qrcode from 'qrcode';

import { EmailService } from '@/email/email.service';
import { EMAIL_TYPES } from '@/email/types.enum';
import { TotpSecretQrcode } from '@/otp/dto/totp-secret-qr-code.dto';
import { Otp, OtpMeta, OtpMethod, OtpPurpose, OtpStatus } from '@/otp/entity/otp.entity';
import { User } from '@/users/entities/user.entity';

export interface OtpSendParams {
  purpose: OtpPurpose;
  method?: OtpMethod;
  meta?: OtpMeta;
  context?: object;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly twilioService: TwilioService,
  ) {
    const hotpConfig = {
      digits: +config.get('otp.otp_digits_length'),
    };
    hotp.options = hotpConfig;
    authenticator.options = hotpConfig;
  }

  private setDefaultForOtpSendParams(params: OtpSendParams) {
    if (!params.method) {
      params.method = OtpMethod.Email;
    }
    if (!params.context) {
      params.context = {};
    }

    return params;
  }

  public async send(user: User, params: OtpSendParams) {
    params = this.setDefaultForOtpSendParams(params);

    const otpToken = await this.generateOtp(user, params);
    const sendContext = {
      ...params.context,
      token: otpToken,
    };

    if (params.method == OtpMethod.Email) {
      await this.sendEmail(user, params, sendContext);
    }
    if (params.method == OtpMethod.SMS) {
      await this.sendSms(user, params, sendContext);
    }
  }

  private async sendEmail(user: User, params: OtpSendParams, context: object) {
    await this.emailService.send({
      to: user,
      type: this.getEmailType(params.purpose),
      context,
    });
  }

  private getEmailType(purpose: OtpPurpose) {
    switch (purpose) {
      case OtpPurpose.ConfirmEmail:
        return EMAIL_TYPES.INVITATION;
      case OtpPurpose.SetPassword:
        return EMAIL_TYPES.SET_PASSWORD;
      case OtpPurpose.ForgetPassword:
        return EMAIL_TYPES.PASSWORD_RESET;
      case OtpPurpose.ChangeEmail:
        return EMAIL_TYPES.CHANGE_EMAIL;
    }
  }

  private sendSms(
    user: User,
    params: OtpSendParams,
    context: { token: string },
  ) {
    const content = 'Your password: ' + context.token;

    if (!this.twilioService) {
      return this.logger.error(
        `SMS supposed to be sent, but Twilio Service is not configured (${content})`,
      );
    }

    return this.twilioService.client.messages.create({
      body: content,
      from: this.config.get('twilio.phone_number_from'),
      to: user?.phoneNumber,
    });
  }

  private async generateOtp(
    user: User,
    params: OtpSendParams,
  ): Promise<string> {
    const previous = await this.getActiveOtp(user, params);
    if (previous) {
      previous.status = OtpStatus.Skipped;
      await previous.save();
    }

    const ttl = this.config.get('otp.hotp_ttl');
    // Every call equals to unique integer
    const hotpCounter = Math.round(new Date().getTime() / 1000 / 2);

    await Otp.create({
      user_id: user.id,
      expires_at: addSeconds(new Date(), ttl),
      hotpCounter,
      method: params.method,
      purpose: params.purpose,
      status: OtpStatus.Active,
      meta: params.meta,
    });

    return hotp.generate(user.otp_secret, hotpCounter);
  }

  public async getActiveOtp(user: User, params: OtpSendParams): Promise<Otp> {
    return this.getOtpByStatus(user, params, OtpStatus.Active);
  }

  public async getOtpByStatus(
    user: User,
    params: OtpSendParams,
    status: OtpStatus,
  ): Promise<Otp> {
    params = this.setDefaultForOtpSendParams(params);

    return Otp.findOne({
      where: {
        user_id: user.id,
        method: params.method,
        purpose: params.purpose,
        status,
      },
    });
  }

  public async verifyOtp(
    user: User,
    params: OtpSendParams,
    otpToken: string,
  ): Promise<boolean> {
    const stored = await this.getActiveOtp(user, params);
    if (!stored || new Date() > stored.expires_at) {
      return false;
    }

    if (params.method === OtpMethod.Authenticator) {
      return authenticator.check(otpToken, user.otp_secret);
    }

    return hotp.check(otpToken, user.otp_secret, stored.hotpCounter);
  }

  public async setOtpUsed(user: User, params: OtpSendParams) {
    const stored = await this.getActiveOtp(user, params);

    stored.status = OtpStatus.Used;
    await stored.save();
  }

  public async getSecretQrcode(user: User): Promise<TotpSecretQrcode> {
    const otpauth = authenticator.keyuri(
      user.email,
      'company',
      user.otp_secret,
    );

    return { dataUri: qrcode.toDataURL(otpauth) };
  }
}
