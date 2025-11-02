// netlify/functions/send-contact.js
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const { name, email, message } = data;

    if (!name || !email || !message) {
      return { statusCode: 400, body: "Missing required fields" };
    }

    const sgPayload = {
      personalizations: [
        { to: [{ email: process.env.CONTACT_TO_EMAIL }], subject: `New contact from ${name}` }
      ],
      from: { email: process.env.CONTACT_FROM_EMAIL }, // must be verified in SendGrid
      reply_to: { email },
      content: [
        { type: "text/plain", value: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}` }
      ],
    };

    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sgPayload),
    });

    if (resp.status >= 200 && resp.status < 300) {
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    const text = await resp.text();
    return { statusCode: 500, body: `SendGrid error: ${resp.status} ${text}` };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message || err}` };
  }
};
