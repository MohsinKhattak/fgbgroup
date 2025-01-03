import { queryAllTables } from "./supabase";
import { sendQueryToOpenAI } from "./openai";

export const dynamicSearch = async (query, context) => {
  try {
    const aiResponse = await sendQueryToOpenAI(query);
    if (aiResponse.type === "error") {
      return aiResponse;
    }

    const { producttype, wattage, colortemp } = aiResponse.parsedQuery;
    const results = await queryAllTables(query);

    return results.length > 0
      ? { type: "results", results }
      : { type: "error", message: "No matching products found." };
  } catch (error) {
    console.error("Error during search:", error);
    return { type: "error", message: "An error occurred while processing your query." };
  }
};
