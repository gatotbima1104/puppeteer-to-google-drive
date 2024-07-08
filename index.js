import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { setTimeout } from "timers/promises";
import { google } from "googleapis";
import * as dotenv from "dotenv";
import axios from "axios";
import fs from "fs"

dotenv.config();
puppeteer.use(StealthPlugin());

// Initiate variable
const folderID = process.env.FOLDER_ID;
const SCOPE = ['https://www.googleapis.com/auth/drive.file']
const credentialPath = JSON.parse(fs.readFileSync('./credential.json', 'utf8'))

// File names configurate
const currentDate = new Date();
const hours = currentDate.getHours().toString().padStart(2, '0');
const minutes = currentDate.getMinutes().toString().padStart(2, '0');

const day = currentDate.getDate().toString().padStart(2, '0');
const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Note: Month is zero-indexed
const year = currentDate.getFullYear();

const timeFormatted = `${hours}:${minutes}`;
const dateFormatted = `${day}/${month}/${year}`;

// Function authorize
async function uploadToDrive(fileStream, fileName, folderID){
    try {
        console.log(`Uploading to Google Drive ....`)
        // Assign to google credential
        const auth = new google.auth.GoogleAuth({
            credentials: credentialPath,
            scopes: SCOPE,   
        })
    
        // Make assign using google drive
        const drive = google.drive({
            version: 'v3',
            auth
        })

        // Configurate creating files to drive
        const res = await drive.files.create({
            // Configurate media
            media: {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                body: fileStream
            },
            // Configurate request body
            requestBody: {
                name: fileName,
                parents: [folderID]
            },
            // Configurate field
            fields: 'id, name'
        })

        console.log(`File Uploaded Name: ${res.data.name}`)
        console.log(`File Uploaded ID: ${res.data.id}`)
    } catch (error) {
        console.log(error)
        throw error
    }
}

// Function Download file in Memory
async function downloadFile(page, downloadSelector){
    try {
        // Download File
        console.log(`Downloading File ....`)
        const client = await page.target().createCDPSession()
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: '/'
        })
    
        // Click download btn
        await clickBtn(page, downloadSelector)
    
        // Capture download URL from response
        const downloadUrl = await new Promise(resolve => {
            page.on('response', response => {
                const contentDisposition = response.headers()['content-disposition']
                if(contentDisposition && contentDisposition.includes('attachment')){
                    resolve(response.url())
                }
            });
        })
    
        // Download file using axios > stream file to next application media
        const response = await axios.get(downloadUrl, {
            responseType: "stream", 
        })

        return response.data

    } catch (error) {
        console.log(error)
        throw error
    }

}

// Function clickBtn
async function clickBtn(page, selector){
    const elementSelector = selector
    await page.waitForSelector(elementSelector)
    await page.click(elementSelector)
    await setTimeout(1000)
}

// Main Function
(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [`--no-sandbox`],
    });

    const page = await browser.newPage();
    await page.goto(
      "https://manduka.app.box.com/s/bw560x2fv7h0rj55vxybneq8nmgarbo1/folder/118323263344",
      { waitUntil: "domcontentloaded" }
    );

    // Click excel file
    await clickBtn(page, 'div.TableRow-focusBorder')

    // Download File to stream
    const downloadSelector = 'header > div.preview-header-right > span > button[data-target-id="Button-download"]'
    const fileStream = await downloadFile(page, downloadSelector)

    // Upload to Google Drive
    const fileName = `${timeFormatted}_${dateFormatted}_manduka.xlsx`;
    await uploadToDrive(fileStream, fileName, folderID)

    await browser.close()
  } catch (error) {
    console.log(error);
  }
})();
