import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TotpSecretQrcode {
  @Field()
  dataUri: string;
}
