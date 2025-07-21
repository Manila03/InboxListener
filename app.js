const Imap = require("imap");
const { simpleParser } = require("mailparser");
const dotenv = require("dotenv");
const axios = require("axios");
import { GoogleGenerativeAI } from "@google/generative-ai";


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
  //model: "gemini-pro",
  model: "gemini-flash",
  geminiConfig,
});

const imap = new Imap({
  user: process.env.IMAP_USER,
  password: process.env.IMAP_PASS,
  host: process.env.IMAP_HOST,
  port: parseInt(process.env.IMAP_PORT),
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
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
            const subject = parsed.subject.toLowerCase() || "(Sin asunto)";
            const text = parsed.text.toLowerCase() || "";

            console.log("Nuevo correo recibido");
            console.log("De:", from);
            console.log("Asunto:", subject);

            if (text != "" && (text.includesIgnoreCase("precio") || text.includesIgnoreCase("tacho") || text.includesIgnoreCase("modelo") || text.includesIgnoreCase("mercado libre"))){
                const response = await processMail(parsed);
                console.log("response: "+response);
                if (response == null || response == undefined || response === "NULL") {
                    console.log("No hay respuesta");
                } else {
                    enviarRespuesta();
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
    const excelPath = path.join(__dirname, process.env.EXCEL_PATH.toString());
    const workbook = xlsx.readFile(excelPath);

    // Leer la primera hoja
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convertir a JSON
    const data = xlsx.utils.sheet_to_json(worksheet);

    return data; // Devuelve un array de objetos con cada fila
  } catch (error) {
    console.log("error al intentar obtener la informacion del excel");
    return null;
  }
}

async function processMail(parsedText){
    const from = parsedText.from?.text || "Desconocido";
    const subject = parsedText.subject || "(Sin asunto)";
    const text = parsedText.text || "";

    const generate = async () => {
    try {
        const prompt = "" + process.env.ENDPOINT + excelData + process.env.GEMINI_PROMPT_MAILDATA;
        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        console.log(response.text());
    } catch (error) {
        console.log("response error", error);
    }
    };
    return response.text();
}

function enviarRespuesta(){
    return null;
}