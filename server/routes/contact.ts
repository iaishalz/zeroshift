import { Router, Request, Response } from "express";
import { z } from "zod";

const router = Router();

const contactFormSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  company: z.string().max(100).optional(),
  message: z.string().min(10).max(5000),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

async function sendEmailViaSendGrid(data: ContactFormData): Promise<void> {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;

  if (!sendgridApiKey) {
    throw new Error("SendGrid API key not configured");
  }

  const emailContent = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
    ${data.company ? `<p><strong>Company:</strong> ${escapeHtml(data.company)}</p>` : ""}
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(data.message).replace(/\n/g, "<br>")}</p>
  `;

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendgridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: "hello@zeroshift.ae" }],
          subject: `New Contact Form Submission from ${data.name}`,
        },
      ],
      from: { email: process.env.SENDGRID_FROM_EMAIL || "noreply@zeroshift.ae" },
      content: [
        {
          type: "text/html",
          value: emailContent,
        },
      ],
      replyTo: { email: data.email },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid error: ${response.status} - ${error}`);
  }
}

async function sendEmailViaNetlifyFunctions(data: ContactFormData): Promise<void> {
  const netlifyFunctionUrl = process.env.NETLIFY_FUNCTION_EMAIL_URL;

  if (!netlifyFunctionUrl) {
    throw new Error("Netlify email function not configured");
  }

  const response = await fetch(netlifyFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Email function error: ${response.status}`);
  }
}

async function sendEmail(data: ContactFormData): Promise<void> {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;

  if (sendgridApiKey) {
    await sendEmailViaSendGrid(data);
  } else {
    console.log("Contact form submission (email service not configured):", data);
  }
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

router.post("/contact", async (req: Request, res: Response) => {
  try {
    const data = contactFormSchema.parse(req.body);

    try {
      await sendEmail(data);
      res.json({
        success: true,
        message: "Contact form submitted successfully",
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      console.log("Contact form data logged for manual processing:", data);
      res.json({
        success: true,
        message: "Contact form submitted successfully. We will be in touch soon.",
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: "Invalid form data",
        details: error.errors,
      });
    } else if (error instanceof Error) {
      console.error("Contact form error:", error);
      res.status(500).json({
        success: false,
        error: "An error occurred processing your request",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "An unexpected error occurred",
      });
    }
  }
});

export const contactRouter = router;
