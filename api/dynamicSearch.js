import { createClient } from "@supabase/supabase-js";
import { Configuration, OpenAIApi } from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { query, context } = req.body;
  console.log("User Query Received:", query);

  try {
    const aiResponse = await openai.createCompletion({
      model: "gpt-3.5-turbo",
      prompt: `
        You are a helpful assistant for a database of lighting products.
        Based on the query: "${query}", extract the following fields:
        - producttype (e.g., area light, wall pack)
        - wattage (e.g., 50 watts, 100 watts)
        - color temperature (e.g., 5000K)
        If no specific details are provided, respond with producttype: "all".
        Provide the output in JSON format.
      `,
      max_tokens: 100,
    });

    const aiOutput = aiResponse.data.choices[0].text.trim();
    console.log("OpenAI Output:", aiOutput);

    let parsedQuery;
    try {
      parsedQuery = JSON.parse(aiOutput);
    } catch (err) {
      console.error("Error parsing OpenAI output:", err);
      return res
        .status(500)
        .json({ error: "Failed to interpret the user query." });
    }

    const { producttype, wattage, colortemp } = parsedQuery;
    const tableNames = ["area_lights", "corn_lamp_stubbys", "wall_packs"];
    let results = [];

    for (const table of tableNames) {
      let queryBuilder = supabase.from(table).select("*");

      if (producttype && producttype !== "all")
        queryBuilder.eq("producttype", producttype);
      if (wattage) queryBuilder.ilike("wattage", `%${wattage}%`);
      if (colortemp) queryBuilder.ilike("colortemp", `%${colortemp}%`);

      const { data, error } = await queryBuilder;

      if (error) {
        console.error(`Error querying ${table}:`, error);
        continue;
      }

      if (data && data.length > 0) {
        results.push({ table, data });
      }
    }

    return results.length > 0
      ? res.status(200).json({ type: "results", results })
      : res
          .status(404)
          .json({ type: "error", message: "No matching products found." });
  } catch (error) {
    console.error("Error during search:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while processing your query." });
  }
}
