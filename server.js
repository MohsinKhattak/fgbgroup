import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const app = express(); // Initialize the Express app
const port = 5001;

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse incoming JSON requests

// Debugging: Confirm environment variables are loaded correctly
console.log("Supabase URL:", process.env.SUPABASE_URL || "Not defined");
console.log(
  "Supabase Anon Key:",
  process.env.SUPABASE_ANON_KEY || "Not defined"
);
console.log("OpenAI API Key:", process.env.OPENAI_API_KEY || "Not defined");

// Ensure environment variables are set before proceeding
if (
  !process.env.SUPABASE_URL ||
  !process.env.SUPABASE_ANON_KEY ||
  !process.env.OPENAI_API_KEY
) {
  console.error("ERROR: Missing required environment variables.");
  process.exit(1); // Exit the process with an error code
}

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// API route for dynamicSearch
app.post("/api/dynamicSearch", async (req, res) => {
  const { query, context } = req.body;

  console.log("Incoming query from frontend:", req.body); // Debugging log

  if (!query || typeof query !== "string") {
    console.error("Invalid query:", query); // Debugging log
    return res.status(400).json({
      type: "error",
      message: "Query is required and must be a string.",
    });
  }

  try {
    console.log("Sending query to OpenAI:", query); // Debugging log
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `
You are a helpful assistant for a lighting products database answer briefly. Based on the user query: "${query}":

1. Extract:
   - **producttype**: e.g., "area light", "wall pack", "stubby corn lamp" (default to "all" if unspecified).
   - **wattage**: e.g., "50", "100" (default to "*" if unspecified).
   - **colortemp**: e.g., "3000", "5000" (default to "*" if unspecified).

2. If fields are missing or ambiguous ("*"), create a follow-up question for clarification.

3. Return JSON:
   - If complete:
     {
       productDetails:{
       "producttype": "product-type-value",
       "wattage": "wattage-value",
       "colortemp": "color-temp-value"}
     }
   - If incomplete:
     {
       "followUp": ["question"]
     }
`,
        },
      ],
      max_tokens: 100,
    });

    console.log("OpenAI Response:", aiResponse); // Debugging log
    let aiOutput = aiResponse.choices[0].message.content.trim();
    console.log("Raw OpenAI Output:", aiOutput);
    const objStartBracketIndex = aiOutput.indexOf("{");
    const objEndBracketIndex = aiOutput.lastIndexOf("}");
    aiOutput = aiOutput.slice(objStartBracketIndex, objEndBracketIndex + 1);
    console.log(aiOutput, "---------------------after slicing");
    const parsedOutput = JSON.parse(aiOutput);

    let results = [];

    if (parsedOutput.productDetails) {
      const productDetails = parsedOutput.productDetails;
      console.log(productDetails, "-----------------product details");
      const { producttype, wattage, colortemp } = productDetails;
      console.log("Parsed Query for Supabase:", {
        producttype,
        wattage,
        colortemp,
      }); // Debugging log

      const tableMapping = {
        "wall pack": "wall_packs",
        "wall packs": "wall_packs",
        "area light": "area_lights",
        "area lights": "area_lights",
        "stubby corn lamp": "corn_lamp_stubbys",
      };
      const targetTable = tableMapping[producttype?.toLowerCase()];

      if (targetTable) {
        console.log(`Querying specific table: ${targetTable}`);
        console.log("Filter values:", { wattage, colortemp });

        let queryBuilder = supabase.from(targetTable).select("*");

        if (wattage)
          queryBuilder = queryBuilder.ilike("wattage", `%${wattage}%`);
        if (colortemp)
          queryBuilder = queryBuilder.ilike("colortemp", `%${colortemp}%`);

        console.log(
          queryBuilder,
          "------------query builder is <----------------"
        );
        const { data, error } = await queryBuilder;

        if (error) {
          console.error(`Error querying ${targetTable}:`, error);
          return res
            .status(500)
            .json({ type: "error", message: "Error querying the database." });
        }

        results.push({ table: targetTable, data: data });
      }
    } else if (parsedOutput.followUp) {
      const followUpQuestions = parsedOutput?.followUp[0];
      results.push({ question: followUpQuestions });
      console.log(followUpQuestions, "-----------------follow up question");
    }

    if (results.length > 0 && results[0].question) {
      res.json({ type: "question", results });
    } else if (results.length > 0 && !results[0].question) {
      res.json({ type: "results", results });
    } else {
      res
        .status(404)
        .json({ type: "error", message: "No matching products found." });
    }
  } catch (error) {
    console.error("Error in /api/dynamicSearch route:", error);
    res.status(500).json({
      type: "error",
      message: "An error occurred while processing your request.",
    });
  }
});

// Fallback route for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
