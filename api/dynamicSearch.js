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
          //   content: `
          //                 You are a helpful assistant for a database of lighting products.
          //                 Based on the query: "${query}", extract the following fields:
          //                 - producttype (e.g., area light, wall pack)
          //                 - wattage (e.g., 50 watts, 100 watts)
          //                 - color temperature (e.g., 5000)
          //                 If no specific details are provided, respond with producttype: "all".
          //                 Provide the output in JSON format.
          //             `,
          //           content: `
          //   You are a helpful assistant for a database of lighting products.
          //   Based on the query: "${query}", extract the following fields:
          //   - producttype (e.g., area lights, wall packs)
          //   - wattage (e.g., 50, 100)
          //   - colortemp (use exactly this spelling for "color temperature", e.g., 5000)
          //   If no specific details are provided, respond with:
          //   { "producttype": "all", "wattage": "*", "colortemp": "*" }
          //   Provide the output in JSON format only like this { "producttype": "product-type-value", "wattage": "wattage-value", "colortemp": "color-temp-value" }.
          // `,

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
    // if (parsedOutput.followUp) {
    //   const followUpQuestions = parsedOutput?.followUp[0];
    //   console.log(followUpQuestions, "-----------------follow up question");
    // }
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

      // Map producttype to corresponding tables
      const tableMapping = {
        "wall pack": "wall_packs",
        "wall packs": "wall_packs",
        "area light": "area_lights",
        "area lights": "area_lights",
        "stubby corn lamp": "corn_lamp_stubbys",
      };
      const targetTable = tableMapping[producttype?.toLowerCase()];

      if (targetTable) {
        // Query the specific table
        console.log(`Querying specific table: ${targetTable}`);
        console.log("Filter values:", { wattage, colortemp });

        let queryBuilder = supabase.from(targetTable).select("*");

        // Apply filters only if values are provided
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
    // aiOutput = aiOutput.slice(objStartBracketIndex);
    // console.log("OpenAI Output After Slicing:", aiOutput); // Debugging log

    // let parsedQuery;
    // try {
    //   parsedQuery = JSON.parse(aiOutput);
    //   console.log("Parsed OpenAI Output:", parsedQuery); // Debugging log
    // } catch (err) {
    //   console.error("Error parsing OpenAI output:", err);
    //   return res
    //     .status(500)
    //     .json({ type: "error", message: "OpenAI response is not valid JSON." });
    // }

    //   const { producttype, wattage, colortemp } = parsedQuery;
    //   console.log("Parsed Query for Supabase:", {
    //     producttype,
    //     wattage,
    //     colortemp,
    //   }); // Debugging log

    //   // Map producttype to corresponding tables
    //   const tableMapping = {
    //     "wall pack": "wall_packs",
    //     "area light": "area_lights",
    //     "stubby corn lamp": "corn_lamp_stubbys",
    //   };

    //   const targetTable = tableMapping[producttype?.toLowerCase()];
    //   let results = [];

    //   if (targetTable) {
    //     // Query the specific table
    //     console.log(`Querying specific table: ${targetTable}`);
    //     console.log("Filter values:", { wattage, colortemp });

    //     let queryBuilder = supabase.from(targetTable).select("*");

    //     // Apply filters only if values are provided
    //     if (wattage) queryBuilder = queryBuilder.ilike("wattage", `%${wattage}%`);
    //     if (colortemp)
    //       queryBuilder = queryBuilder.ilike("colortemp", `%${colortemp}%`);

    //     console.log(
    //       queryBuilder,
    //       "------------query builder is <----------------"
    //     );
    //     const { data, error } = await queryBuilder;

    //     if (error) {
    //       console.error(`Error querying ${targetTable}:`, error);
    //       return res
    //         .status(500)
    //         .json({ type: "error", message: "Error querying the database." });
    //     }

    //     results.push({ table: targetTable, data: data });
    //   } else {
    //     // Query all tables if no specific producttype is identified
    //     console.log("No specific producttype found, querying all tables...");
    //     const tableNames = Object.values(tableMapping);

    //     for (const table of tableNames) {
    //       try {
    //         console.log(`Querying table: ${table}`);
    //         let queryBuilder = supabase.from(table).select("*");

    //         if (wattage)
    //           queryBuilder = queryBuilder.ilike("wattage", `%${wattage}%`);
    //         if (colortemp)
    //           queryBuilder = queryBuilder.ilike("colortemp", `%${colortemp}%`);

    //         const { data, error } = await queryBuilder;

    //         if (error) {
    //           console.error(`Error querying ${table}:`, error);
    //           continue;
    //         }

    //         if (data && data.length > 0) {
    //           results.push({ table, data });
    //         }
    //       } catch (error) {
    //         console.error(`Unexpected error querying ${table}:`, error);
    //       }
    //     }
    //   }

    //   console.log("Results to return to frontend:", results); // Debugging log

    //   if (results.length > 0) {
    //     res.json({ type: "results", results });
    //   } else {
    //     res
    //       .status(404)
    //       .json({ type: "error", message: "No matching products found." });
    //   }
  } catch (error) {
    console.error("Error in /api/dynamicSearch route:", error);
    res.status(500).json({
      type: "error",
      message: "An error occurred while processing your request.",
    });
  }
}
