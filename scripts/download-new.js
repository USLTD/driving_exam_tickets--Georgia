import { existsSync, write } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const BASE_URL = new URL("https://api-my.sa.gov.ge");
const BASE_ASSETS_PATH = resolve(join("..", "data"));
const BASE_IMAGES_PATH = join(BASE_ASSETS_PATH, "images");
const BASE_TICKETS_PATH = join(BASE_ASSETS_PATH, "tickets");
const BASE_EXPLANATIONS_PATH = join(BASE_ASSETS_PATH, "explanations");

// Types
/**
 * @typedef {{ id: number, language: string }} Language
 */

/**
 * @typedef {{ id: number, categoryName: string }} Category
 */

/**
 * @typedef {{ answer: string, answerNumbering: number }} TicketAnswer
 */

/**
 * @typedef {{ id: number, examTicketId: number, imageId: number | null, question: string, answers: Array<TicketAnswer>, rightAnswer: number }} Ticket
 */

/**
 * @typedef {string | null} Explanation
 */

/**
 * @typedef {{ id: number, extension: string, buffer: Buffer }} Image
 */

// Fetch methods
/**
 * Get languages
 * @returns {Promise<Array<Language>>}
 */
async function getLanguages() {
  const url = new URL("/api/v1/ExamLanguages", BASE_URL);

  console.log(`Fetching ${url}...`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch languages");
  }

  return await response.json();
}

/**
 * Get categories
 * @returns {Promise<Array<Category>>}
 */
async function getCategories() {
  const url = new URL("/api/v1/DrivingLicenseExamCategories", BASE_URL);

  console.log(`Fetching ${url}...`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch categories");
  }

  return await response.json();
}

/**
 * Get tickets
 * @param {number} categoryId
 * @param {number} languageId
 * @returns {Promise<Array<Ticket>>}
 */
async function getTickets(categoryId, languageId) {
  const url = new URL(
    "/api/v1/DrivingLicenseExams/GetDrivingLicenseTickets",
    BASE_URL,
  );

  url.searchParams.set("CategoryId", categoryId);
  url.searchParams.set("LanguageId", languageId);

  console.log(`Fetching ${url}...`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch tickets`);
  }

  return await response.json();
}

/**
 * Get explanation
 * @param {number} examTicketId
 * @returns {Promise<Explanation>}
 */
async function getExplanation(examTicketId) {
  const url = new URL("/api/v1/DrivingLicenseExams/Description", BASE_URL);

  url.searchParams.set("examTicketId", examTicketId);

  console.log(`Fetching ${url}...`);

  const response = await fetch(url);

  if (!response.ok) {
    console.warn("Explanation not found. Using placeholder...");
    return null;
  }

  return await response.text();
}

/**
 * Download image
 * @param {number} imageId
 */
async function getImage(imageId) {
  const url = new URL("/api/v1/DrivingLicenseExams/GetTicketImage", BASE_URL);

  url.searchParams.set("imageId", imageId);

  console.log(`Fetching ${url}...`);

  const response = await fetch(url);

  if (!response.ok) {
    // throw new Error(`Failed to fetch image`);
    console.warn("Image not found. Using placeholder...");
    await writeFile(join(BASE_IMAGES_PATH, `${imageId}.error`), "NOT IMAGE", {
      encoding: "utf-8",
      flag: "w",
    });
    return;
  }

  const contentType = response.headers.get("Content-Type");

  if (!contentType) {
    throw new Error(`Missing Content-Type in response`);
  }

  const [type, subtype] = contentType.split("/");

  if (type !== "image") {
    throw new Error("Received file is not image");
  }

  const buffer = await response.arrayBuffer();

  await writeFile(
    join(BASE_IMAGES_PATH, `${imageId}.${subtype}`),
    Buffer.from(buffer),
    {
      flag: "w",
    },
  );
}

// Prepare methods
async function prepareBases() {
  if (!existsSync(BASE_ASSETS_PATH)) {
    console.log(`Creating ${BASE_ASSETS_PATH}...`);
    await mkdir(BASE_ASSETS_PATH, { recursive: true });
  }

  if (!existsSync(BASE_IMAGES_PATH)) {
    console.log(`Creating ${BASE_IMAGES_PATH}...`);
    await mkdir(BASE_IMAGES_PATH, { recursive: true });
  }

  if (!existsSync(BASE_TICKETS_PATH)) {
    console.log(`Creating ${BASE_TICKETS_PATH}...`);
    await mkdir(BASE_TICKETS_PATH, { recursive: true });
  }

  if (!existsSync(BASE_EXPLANATIONS_PATH)) {
    console.log(`Creating ${BASE_EXPLANATIONS_PATH}...`);
    await mkdir(BASE_EXPLANATIONS_PATH, { recursive: true });
  }
}

async function prepareLanguageCatalog() {
  const languagesCatalogPath = join(BASE_ASSETS_PATH, "languages.json");

  /** @type {Array<Language>} */
  let languages;

  if (!existsSync(languagesCatalogPath)) {
    languages = await getLanguages();

    console.log("Writing languages catalog...");
    await writeFile(languagesCatalogPath, JSON.stringify(languages), {
      encoding: "utf-8",
      flag: "w",
    });
  } else {
    languages = await readFile(languagesCatalogPath, {
      encoding: "utf-8",
    }).then((value) => JSON.parse(value));
  }

  return languages;
}

async function prepareCategoriesCatalog() {
  const categoriesCatalogPath = join(BASE_ASSETS_PATH, "categories.json");

  /** @type {Array<Category>} */
  let categories;

  if (!existsSync(categoriesCatalogPath)) {
    categories = await getCategories();

    console.log("Writing categories catalog...");
    await writeFile(categoriesCatalogPath, JSON.stringify(categories), {
      encoding: "utf-8",
      flag: "w",
    });
  } else {
    categories = await readFile(categoriesCatalogPath, {
      encoding: "utf-8",
    }).then((value) => JSON.parse(value));
  }

  return categories;
}

// Entry point
async function main() {
  await prepareBases();

  const languages = await prepareLanguageCatalog();
  const categories = await prepareCategoriesCatalog();

  for (const language of languages) {
    const localizedTicketsPath = join(BASE_TICKETS_PATH, String(language.id));

    if (!existsSync(localizedTicketsPath)) {
      console.log(`Creating ${localizedTicketsPath}...`);
      await mkdir(localizedTicketsPath, { recursive: true });
    }

    for (const category of categories) {
      const categoryTicketsPath = join(
        localizedTicketsPath,
        String(category.id),
      );

      if (!existsSync(categoryTicketsPath)) {
        console.log(`Creating ${categoryTicketsPath}...`);
        await mkdir(categoryTicketsPath, { recursive: true });
      }

      const tickets = await getTickets(category.id, String(language.id));

      console.log(`Writing tickets catalog`);
      await writeFile(
        join(categoryTicketsPath, `catalog.json`),
        JSON.stringify(tickets),
        {
          encoding: "utf-8",
          flag: "w",
        },
      );

      for (const ticket of tickets) {
        const ticketPath = join(categoryTicketsPath, `${ticket.id}.json`);

        if (ticket.imageId) {
          const existingImages = await readdir(BASE_IMAGES_PATH);

          if (
            !existingImages.find(
              (image) => image.split(".")[0] === String(ticket.imageId),
            )
          ) {
            await getImage(ticket.imageId);
          }
        }

        if (!existsSync(ticketPath)) {
          const explanationPath = join(
            BASE_EXPLANATIONS_PATH,
            `${ticket.examTicketId}.txt`,
          );

          /** @type {Explanation} */
          let explanation = null;

          if (!existsSync(explanationPath)) {
            explanation = await getExplanation(ticket.examTicketId);

            console.log("Writing explanation...");
            await writeFile(
              explanationPath,
              explanation === null ? "" : explanation,
              {
                encoding: "utf-8",
                flag: "w",
              },
            );
          } else {
            explanation = await readFile(explanationPath, {
              encoding: "utf-8",
            }).then((value) => {
              if (!value) {
                return null;
              }

              return value;
            });
          }

          /** @type {Ticket & { explanation: Explanation }} */
          const output = {
            ...ticket,
            explanation: explanation,
          };

          console.log(`Writing ticket ${ticket.id}`);
          await writeFile(ticketPath, JSON.stringify(output), {
            encoding: "utf-8",
            flag: "w",
          });
        }
      }
    }
  }
}

main().catch((reason) => console.error(reason));
