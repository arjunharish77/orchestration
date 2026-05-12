import { BadRequestException } from '@nestjs/common';

const passwordPolicyMessage =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

export function assertPasswordPolicy(password: string) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];

  if (checks.some((passed) => !passed)) {
    throw new BadRequestException(passwordPolicyMessage);
  }
}

