import { createClient } from "@supabase/supabase-js";
import { Configuration, OpenAIApi } from "openai";

import dotenv from "dotenv";
import path from "path";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAIApi({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { query, context } = req.body;
  console.log("User Query Received:", query);

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
}
