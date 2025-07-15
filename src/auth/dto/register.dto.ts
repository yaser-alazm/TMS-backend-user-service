import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string({ message: 'Username must be a string' })
    .min(3, { message: 'Username must be at least 3 characters long' })
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, { message: 'Username is required' }),

  email: z
    .string({ message: 'Email is required' })
    .email({ message: 'Please provide a valid email address' })
    .transform((val) => val.toLowerCase().trim()),

  password: z
    .string({ message: 'Password must be a string' })
    .min(8, { message: 'Password must be at least 8 characters long' })
    .regex(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
      message:
        'Password must contain uppercase, lowercase, number/special character',
    })
    .refine((val) => val.length > 0, { message: 'Password is required' }),

  firstName: z
    .string({ message: 'First name must be a string' })
    .transform((val) => val?.trim())
    .optional(),

  lastName: z
    .string({ message: 'Last name must be a string' })
    .transform((val) => val.trim())
    .optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;
// export class RegisterDto {

//   @IsNotEmpty({ message: 'Email is required' })
//   @IsEmail({}, { message: 'Please provide a valid email address' })
//   @Transform(({ value }: { value: unknown }) =>
//     typeof value === 'string' ? value.toLowerCase().trim() : value,
//   )
//   email!: string;

//   @IsNotEmpty({ message: 'Password is required' })
//   @IsString({ message: 'Password must be a string' })
//   @MinLength(8, { message: 'Password must be at least 8 characters long' })
//   @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
//     message:
//       'Password must contain uppercase, lowercase, number/special character',
//   })
//   password!: string;

//   @IsOptional()
//   @IsString({ message: 'First name must be a string' })
//   @Transform(({ value }: { value: unknown }) =>
//     typeof value === 'string' ? value?.trim() : value,
//   )
//   firstName?: string;

//   @IsOptional()
//   @IsString({ message: 'Last name must be a string' })
//   @Transform(({ value }: { value: unknown }) =>
//     typeof value === 'string' ? value.trim() : value,
//   )
//   lastName?: string;
// }
