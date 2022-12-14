import { Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { TotpSecretQrcode } from '@/otp/dto/totp-secret-qr-code.dto';
import { OtpService } from '@/otp/otp.service';
import { User } from '@/users/entities/user.entity';

@Resolver()
export class OtpResolver {
  constructor(private readonly otpService: OtpService) {}

  @Query(() => TotpSecretQrcode)
  async totpSecretQrcode(@CurrentUser() user: User): Promise<TotpSecretQrcode> {
    return this.otpService.getSecretQrcode(user);
  }
}
