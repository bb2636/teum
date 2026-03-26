export interface SmsProvider {
  sendSms(options: {
    to: string;
    text: string;
  }): Promise<void>;
}
