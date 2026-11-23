export type TwoFactorSetup = { secret: string; backupCodes: string[] };

export type SecurityStatus = {
  twoFactorEnabled: boolean;
  phone: string | null;
  phoneVerified: boolean;
  backupCodesRemaining: number;
};

export type SignInEventView = {
  id: string;
  occurredAt: string;
  device: string;
  location: string;
  method: string;
  newDevice: boolean;
};
