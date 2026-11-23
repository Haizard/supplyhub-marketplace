export type TwoFactorSetup = { secret: string; backupCodes: string[] };

export type SecurityStatus = {
  twoFactorEnabled: boolean;
  phone: string | null;
  phoneVerified: boolean;
  backupCodesRemaining: number;
};
