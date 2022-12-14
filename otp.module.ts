import { ConfigurableModuleBuilder, DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { TwilioModule, TwilioService } from 'nestjs-twilio';

import { EmailModule } from '@/email/email.module';
import { Otp } from '@/otp/entity/otp.entity';
import { OtpResolver } from '@/otp/otp.resolver';

import { OtpService } from './otp.service';

@Module({})
export class OtpModule {
  static register(): DynamicModule {
    const imports = [
      SequelizeModule.forFeature([Otp]),
      EmailModule,
      ConfigModule,
    ]

    const providers: Provider[] = [OtpService, OtpResolver]

    if (process.env.TWILIO_AUTH_TOKEN) {
      imports.push(
        TwilioModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (cfg: ConfigService) => ({
            accountSid: cfg.get('twilio.account_sid'),
            authToken: cfg.get('twilio.auth_token'),
          }),
          inject: [ConfigService],
        }),
      )
    } else {
      providers.push({
        useValue: null,
        provide: TwilioService,
      } as Provider)
    }

    return {
      imports,
      providers,
      module: OtpModule,
      exports: [OtpService],
    }
  }
}
