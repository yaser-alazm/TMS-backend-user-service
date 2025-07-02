import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  username!: string; // Can be username or email

  @IsNotEmpty()
  @IsString()
  password!: string;
}
