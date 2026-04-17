export interface SmsProvider {
  sendSms(options: {
    to: string;
    text: string;
  }): Promise<void>;
  sendVerification(to: string): Promise<void>;
  checkVerification(to: string, code: string): Promise<boolean>;
}
