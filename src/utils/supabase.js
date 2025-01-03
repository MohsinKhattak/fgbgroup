import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to query all tables dynamically based on user input
export const queryAllTables = async (userQuery) => {
  const tableNames = ["area_lights", "corn_lamp_stubbys", "wall_packs"];
  let results = [];

  for (const table of tableNames) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .ilike("description", `%${userQuery}%`); // Replace 'description' with the column used for searching

      if (error) {
        console.error(`Error querying table ${table}:`, error);
        continue; // Skip to the next table if an error occurs
      }

      if (data && data.length > 0) {
        results.push({ table, data }); // Push results if matches are found
      }
    } catch (error) {
      console.error(`Unexpected error querying table ${table}:`, error);
    }
  }

  // Return results or indicate no matches
  return results.length > 0
    ? results
    : [{ table: "No results", data: [] }];
};