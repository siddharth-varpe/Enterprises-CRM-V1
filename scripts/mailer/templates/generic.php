<?php
/**
 * SR Enterprises - Generic Notification Email Template
 * 
 * Clean, corporate branded email template following official SR Enterprises design specifications.
 */

$customerDisplayName = !empty($toName) ? $toName : (!empty($customerName) ? $customerName : 'Valued Customer');
$subject = !empty($subject) ? $subject : "Notification from {$companyName}";
$otpCode = $otp ?? $payload['otp'] ?? $otpCode ?? null;
$contentBody = !empty($messageBody)
    ? $messageBody
    : (!empty($message)
        ? $message
        : (!empty($content)
            ? $content
            : (!empty($body)
                ? $body
                : (!empty($notes)
                    ? $notes
                    : (!empty($payload['message'])
                        ? $payload['message']
                        : 'Please find your official communication from ' . htmlspecialchars($companyName) . ' enclosed below.')))));

// Plain Text fallback
$plainText = "Hello {$customerDisplayName},\n\n";
if (!empty($otpCode)) {
    $plainText .= "Your verification code is: {$otpCode}\n\n";
}
$plainText .= "{$contentBody}\n\nNeed Assistance?\nHelpline: {$supportPhone}\nEmail: {$supportEmail}\n{$companyName} — Reliable Solutions. Professional Service.\n";

?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><?php echo htmlspecialchars($subject); ?></title>
    <style type="text/css">
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; background-color: #f8fafc; font-family: Arial, Helvetica, sans-serif; color: #1e293b; }
        @media only screen and (max-width: 620px) {
            .email-container { width: 100% !important; max-width: 100% !important; }
            .content-padding { padding: 16px !important; }
            .col-stack { display: block !important; width: 100% !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f8fafc; font-family: Arial, Helvetica, sans-serif; color: #1e293b;">
    <center>
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; margin: 0 auto;" class="email-container">
            <!-- HEADER -->
            <tr>
                <td style="background-color: #061A3A; border-radius: 8px 8px 0 0; padding: 22px 24px;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td valign="middle">
                                <table border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="width: 40px; height: 40px; background-color: #0B63F6; border-radius: 8px; text-align: center; vertical-align: middle; font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: bold; color: #FFFFFF;">
                                            CRM
                                        </td>
                                        <td style="padding-left: 12px; vertical-align: middle;">
                                            <div style="font-family: Arial, Helvetica, sans-serif; font-size: 17px; font-weight: bold; color: #FFFFFF; letter-spacing: 0.5px; line-height: 1.2;">
                                                <?php echo htmlspecialchars($companyName); ?>
                                            </div>
                                            <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #93C5FD; margin-top: 2px;">
                                                Reliable Solutions. Professional Service.
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td align="right" valign="middle">
                                <span style="display: inline-block; background-color: #0B63F6; border-radius: 4px; padding: 4px 10px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; color: #FFFFFF;">
                                    NOTIFICATION
                                </span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- MAIN CONTENT AREA -->
            <tr>
                <td style="background-color: #FFFFFF; padding: 28px 24px; border-left: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0;" class="content-padding">
                    <!-- Greeting -->
                    <div style="font-size: 15px; font-weight: bold; color: #0F172A; margin-bottom: 12px;">
                        Hello <?php echo htmlspecialchars($customerDisplayName); ?>,
                    </div>
                    <div style="font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
                        <?php echo nl2br(htmlspecialchars($contentBody)); ?>
                    </div>

                    <?php if (!empty($otpCode)): ?>
                    <div style="background-color: #0F172A; border: 2px solid #38BDF8; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
                        <div style="font-family: monospace, Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #38BDF8; line-height: 1;">
                            <?php echo htmlspecialchars($otpCode); ?>
                        </div>
                        <div style="font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; font-weight: 600;">
                            Single-Use Verification Code
                        </div>
                    </div>
                    <?php endif; ?>

                    <!-- SUPPORT INFO -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #EAF3FF; border: 1px solid #BFDBFE; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 14px 16px;">
                                <div style="font-size: 12px; font-weight: bold; color: #1E40AF; margin-bottom: 4px;">
                                    Questions or Assistance?
                                </div>
                                <div style="font-size: 12px; color: #1E3A8A; line-height: 1.5;">
                                    Contact our support helpline at <strong><?php echo htmlspecialchars($supportPhone); ?></strong> or email <strong><?php echo htmlspecialchars($supportEmail); ?></strong>.
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- FOOTER -->
            <tr>
                <td style="background-color: #061A3A; border-radius: 0 0 8px 8px; padding: 22px 24px; color: #94A3B8; font-size: 11px; line-height: 1.6;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td>
                                <div style="font-size: 12px; font-weight: bold; color: #FFFFFF; margin-bottom: 4px;">
                                    Need Assistance?
                                </div>
                                <div>Helpline: <strong style="color: #E2E8F0;"><?php echo htmlspecialchars($supportPhone); ?></strong></div>
                                <div>Email: <strong style="color: #E2E8F0;"><?php echo htmlspecialchars($supportEmail); ?></strong></div>
                                <div>Address: <span style="color: #CBD5E1;"><?php echo htmlspecialchars($companyName); ?> — Commercial Services</span></div>
                                <div style="margin-top: 8px; color: #64748B;">
                                    <?php echo htmlspecialchars($companyName); ?> • Reliable Solutions. Professional Service.
                                </div>
                            </td>
                            <td align="right" valign="bottom" style="text-align: right; color: #64748B; font-size: 10px;">
                                © <?php echo date('Y'); ?> <?php echo htmlspecialchars($companyName); ?>.<br />All rights reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </center>
</body>
</html>
