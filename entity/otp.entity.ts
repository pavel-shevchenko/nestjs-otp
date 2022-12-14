import {
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

import { User } from '@/users/entities/user.entity';

export interface OtpMeta {
  new_email?: string;
}

export enum OtpMethod {
  SMS = 'sms',
  Email = 'email',
  Authenticator = 'authenticator',
}

export enum OtpPurpose {
  ConfirmEmail = 'confirm_email',
  SetPassword = 'set_password',
  ForgetPassword = 'forget_password',
  ChangeEmail = 'change_email',
}

export enum OtpStatus {
  Active = 'active',
  Used = 'used',
  Skipped = 'skipped',
}

@Table
export class Otp extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column
  id!: number;

  @ForeignKey(() => User)
  @Column({
    allowNull: false,
  })
  user_id: number;

  @BelongsTo(() => User, {
    onDelete: 'CASCADE',
  })
  user: User;

  @Column({
    allowNull: false,
  })
  hotpCounter!: number;

  @Column({
    allowNull: false,
  })
  expires_at!: Date;

  @Column({
    allowNull: false,
  })
  method!: OtpMethod;

  @Column({
    allowNull: false,
  })
  purpose!: OtpPurpose;

  @Column({
    allowNull: false,
  })
  status!: OtpStatus;

  @Column({
    defaultValue: '{}',
    type: DataType.JSONB,
  })
  meta!: OtpMeta;
}
