const { GoogleGenerativeAI } = require("@google/generative-ai");

const Imap = require("imap");
const { simpleParser } = require("mailparser");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const xlsx = require("xlsx");
const path = require("path");

const gemini_api_key = process.env.API_KEY;
const googleAI = new GoogleGenerativeAI(gemini_api_key);
const geminiConfig = {
  temperature: 0.9,
  topP: 1,
  topK: 1,
  maxOutputTokens: 4096,
};

const geminiModel = googleAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  geminiConfig,
});

const imap = new Imap({
  user: process.env.IMAP_USER,
  password: process.env.IMAP_PASS,
  host: process.env.IMAP_HOST,
  port: parseInt(process.env.IMAP_PORT),
  tls: true,
  tlsOptions: { 
    rejectUnauthorized: false,
    servername: process.env.IMAP_HOST,
    secureProtocol: 'TLSv1_2_method'
  },
  authTimeout: 15000,
  connTimeout: 15000,
  keepalive: true
});

function openInbox(cb) {
  imap.openBox("INBOX", false, cb);
}

imap.once("ready", () => {
  openInbox((err, box) => {
    if (err) throw err;
    console.log("Conectado a la bandeja de entrada");

    imap.on("mail", () => {
      const fetch = imap.seq.fetch(box.messages.total + ":*", {
        bodies: "",
        markSeen: true
      });

      fetch.on("message", (msg) => {
        msg.on("body", async (stream) => {
            const parsed = await simpleParser(stream);

            const from = parsed.from?.text || "Desconocido";
            const subject = parsed.subject?.toLowerCase() || "(Sin asunto)";
            const text = parsed.text?.toLowerCase() || "";

            console.log("Nuevo correo recibido");
            console.log("De:", from);
            console.log("Asunto:", subject);
            console.log("Contenido:", text);

            if (text != "" && (text.includes("precio") || text.includes("basura") || text.includes("tacho") || text.includes("modelo") || text.includes("mercado libre"))){
                const response = await processMail(parsed);
                console.log("response: "+response);
                if (response == null || response == undefined || response === "NULL" || response === 'NULL') {
                    console.log("No hay respuesta");
                } else {
                    enviarRespuesta(response);
                } 
            }
        });
      });
    });
  });
});

imap.once("error", (err) => {
  console.error("Error IMAP:", err);
});

imap.once("end", () => {
  console.log("Conexión IMAP terminada");
});

imap.connect();

function getExcelInformation(){
    try {
    const excelPath = path.join(__dirname, "tabla.xlsx");
    const workbook = xlsx.readFile(excelPath);

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = xlsx.utils.sheet_to_json(worksheet);

    return data;
  } catch (error) {
    console.log("error al intentar obtener la informacion del excel");
    return null;
  }
}

async function processMail(parsedText){
    const from = parsedText.from?.text || "Desconocido";
    const subject = parsedText.subject?.toLowerCase() || "(Sin asunto)";
    const text = parsedText.text?.toLowerCase() || "";
    try {
        if (text === "") {
          return null;
        }
        
        const excelData = getExcelInformation();
        const excelDataString = JSON.stringify(excelData);

        const prompt = `${process.env.GEMINI_PROMPT} ${excelDataString} ${process.env.GEMINI_PROMPT_MAILDATA} ${text}. Ahora genera una respuesta acorde a este mail.`;
        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        console.log("prompt: "+prompt);
        console.log("response: "+response.text());
        return response.text();
    } catch (error) {
        console.log("response error", error);
        return null;
    }
}

function enviarRespuesta(response){
    console.log("correo enviado con exito");
    console.log("la respuesta de gemini es: ");
    console.log(response);
}
