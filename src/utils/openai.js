import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export const sendQueryToOpenAI = async (query) => {
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: query,
      max_tokens: 100,
    });

    return response.data.choices[0].text;
  } catch (error) {
    console.error("Error querying OpenAI:", error);
    return { type: "error", message: "An error occurred while querying OpenAI." };
  }
};

