/**
 * Email Provider Interface
 * 
 * Defines the contract for email sending implementations.
 */
export interface EmailProvider {
  /**
   * Send an email
   */
  sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void>;
}
