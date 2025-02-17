require("dotenv").config();
const fs = require("fs");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const express = require("express");
const path = require("path");
const multer = require("multer");
const axios = require("axios");
const mustacheExpress = require("mustache-express");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const JOBS = require("./jobs");

app.set("views", path.join(__dirname, "pages"));
app.set("view engine", "mustache");
app.engine("mustache", mustacheExpress());
app.use(express.static(path.join(__dirname, "public")));

// Ensure the 'uploads/' directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/job-list", (req, res) => {
  res.render("job-list", { jobs: JOBS });
});

app.get("/view/:id", (req, res) => {
  const matchedJob = JOBS.find((job) => job.id.toString() === req.params.id);
  res.render("view-job", { matchedJob });
});

app.get("/apply-now/:id", (req, res) => {
  const Job = JOBS.find((job) => job.id.toString() === req.params.id);
  res.render("apply-now", { Job });
});

app.get("/about", (req, res) => {
  res.render("about");
});

// Handle job application submission with file upload
app.post("/applied_job/:id", upload.single("resume"), async (req, res) => {
  const { job_title, full_name, email, phone, coverLetter } = req.body;

  // const hCaptchaResponse = req.body["h-captcha-response"];
  // const secretKey = process.env.HCAPTCHA_SECRET_KEY;

  // console.log("hCaptcha Response:", hCaptchaResponse);

  // try {
  //   // Verify hCaptcha
  //   const verificationResponse = await axios.post(
  //     "https://api.hcaptcha.com/siteverify",
  //     new URLSearchParams({ secret: secretKey, response: hCaptchaResponse })
  //   );

  //   console.log("hCaptcha Verification Response:", verificationResponse.data);

  //   if (!verificationResponse.data.success) {
  //     return res.status(400).render("failed"); // hCaptcha verification failed
  //   }
  // } catch (error) {
  //   console.error("Error verifying hCaptcha:", error);
  //   return res.status(500).render("failed"); // hCaptcha API error
  // }

  // Process job application after successful hCaptcha verification

  const resumePath = req.file ? req.file.path : null;

  const emailTemplatePath = path.join(__dirname, "public/emailTemplate.html");
  let emailTemplate = fs.existsSync(emailTemplatePath)
    ? fs.readFileSync(emailTemplatePath, "utf8")
    : "<p>Hello {{name}},<br>Your application for {{title}} has been received.</p>";

  emailTemplate = emailTemplate
    .replace("{{full_name}}", full_name || "N/A")
    .replace("{{name}}", full_name || "N/A")
    .replace("{{title}}", job_title || "N/A")
    .replace("{{email}}", email || "N/A")
    .replace("{{phone}}", phone || "N/A")
    .replace("{{coverLetter}}", coverLetter || "N/A");

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_ID,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_ID,
    to: email,
    subject: `Application Received: ${job_title}`,
    html: emailTemplate,
    attachments: resumePath
      ? [{ filename: req.file.originalname, path: resumePath }]
      : [],
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
      return res.status(500).render("failed");
    } else {
      console.log("Email sent successfully:", info.response);
      return res.status(200).render("success");
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`App is running on ${port}`));
