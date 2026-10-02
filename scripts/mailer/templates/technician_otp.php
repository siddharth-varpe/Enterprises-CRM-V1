<?php
/**
 * Technician Portal OTP Verification Code Template
 */

$otpCode = $otp ?? $payload['otp'] ?? $otpCode ?? '------';
$expiresMin = (int)($expiresMinutes ?? $payload['expiresMinutes'] ?? 10);
$technicianDisplayName = !empty($toName) ? $toName : (!empty($technicianName) ? $technicianName : 'Technician');
$subject = !empty($subject) ? $subject : "Your Technician Portal Verification Code: {$otpCode}";

$plainText = "Hello {$technicianDisplayName},

Your single-use verification code for the Technician Portal is: {$otpCode}

This verification code is valid for {$expiresMin} minutes.
Do NOT share this code with anyone.

{$companyName} Field Service Operations
Helpline: {$supportPhone}
Email: {$supportEmail}
";
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($subject); ?></title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px 12px; }
        .wrapper { max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35); border: 1px solid #334155; }
        .hero { background: linear-gradient(135deg, #0b63f6 0%, #1e40af 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
        .badge { display: inline-block; background: rgba(255, 255, 255, 0.2); color: #ffffff; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .hero h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 15px; color: #cbd5e1; margin-bottom: 16px; }
        .otp-box { background: #0f172a; border: 2px solid #38bdf8; border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0; box-shadow: 0 4px 12px rgba(56, 189, 248, 0.15); }
        .otp-code { font-family: ui-monospace, Menlo, Monaco, 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #38bdf8; margin: 0; line-height: 1; }
        .otp-sub { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; font-weight: 600; }
        .info-card { background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 8px; padding: 14px 18px; margin-top: 24px; font-size: 12px; color: #94a3b8; line-height: 1.6; }
        .footer { background: #0f172a; padding: 20px 24px; border-top: 1px solid #334155; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="hero">
            <div class="badge">Field Technician Portal</div>
            <h1>Verification Code</h1>
        </div>
        <div class="content">
            <div class="greeting">
                Hello <strong><?php echo htmlspecialchars($technicianDisplayName); ?></strong>,
            </div>
            <p style="font-size: 14px; color: #94a3b8; line-height: 1.5; margin: 0 0 20px 0;">
                Use the following single-use verification code to securely sign in to your field service workspace.
            </p>

            <div class="otp-box">
                <div class="otp-code"><?php echo htmlspecialchars($otpCode); ?></div>
                <div class="otp-sub">Expires in <?php echo htmlspecialchars((string)$expiresMin); ?> minutes</div>
            </div>

            <div class="info-card">
                <div style="color: #cbd5e1; font-weight: 600; margin-bottom: 4px;">🛡️ Security Notice</div>
                <div>• Never share this OTP with anyone. Administration will never request your code.</div>
                <div>• This code is single-use and will automatically expire in <?php echo htmlspecialchars((string)$expiresMin); ?> minutes.</div>
                <div>• If you did not request this login code, please contact dispatch immediately at <strong style="color: #e2e8f0;"><?php echo htmlspecialchars($supportPhone); ?></strong>.</div>
            </div>
        </div>
        <div class="footer">
            <div style="color: #94a3b8; font-weight: 600;"><?php echo htmlspecialchars($companyName); ?> CRM • Field Service Operations</div>
            <div style="margin-top: 4px;">Helpline: <?php echo htmlspecialchars($supportPhone); ?> | Email: <?php echo htmlspecialchars($supportEmail); ?></div>
            <div style="margin-top: 8px;">© <?php echo date('Y'); ?> <?php echo htmlspecialchars($companyName); ?>. All rights reserved.</div>
        </div>
    </div>
</body>
</html>
