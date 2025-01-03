import React, { useState } from "react";
import "./styles/app.css"; // Ensure this is linked correctly

const App = () => {
  const [context, setContext] = useState([]);
  const [userQuery, setUserQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!userQuery.trim()) return;

    setLoading(true);

    try {
      const userMessage = { role: "user", content: userQuery };
      const updatedContext = [...context, userMessage];
      // const API_BASE_URL = "http://localhost:5001";
      const API_BASE_URL =
        import.meta.env.VITE_API_BASE_URL || "https://fgrgroupv2.vercel.app";
      const response = await fetch(`${API_BASE_URL}/api/dynamicSearch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: userQuery, context: updatedContext }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      const result = await response.json();
      console.log(result);

      if (result.type === "results") {
        console.log(result.results);
        const resultsMessage = {
          role: "assistant",
          content:
            "Here are the matching products:\n" +
            result.results
              .map(
                (r) =>
                  `${r.table}: ${r.data
                    .map(
                      (item) =>
                        `${item.product_type} (${
                          item.wattage || "N/A"
                        } watts, ${item.colortemp || "N/A"}K)`
                    )
                    .join(", ")}`
              )
              .join("\n"),
        };
        setContext([...updatedContext, resultsMessage]);
      } else if (result.type === "question") {
        console.log(result.results);
        const resultsMessage = {
          role: "assistant",
          content: result.results[0].question,
        };
        setContext([...updatedContext, resultsMessage]);
      } else {
        const errorMessage = {
          role: "assistant",
          content: result.message || "No matches found.",
        };
        setContext([...updatedContext, errorMessage]);
      }
    } catch (error) {
      console.log(error);
      setContext([
        ...context,
        {
          role: "assistant",
          content: "An error occurred. Please try again later.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <img src="logo.png" alt="FGR Group" className="logo" />
      <h1 className="welcome-message">
        Welcome to FGR Group's Lighting Product Search
      </h1>
      <div className="chatbox-container">
        <div className="response-container">
          {context.map((msg, index) => (
            <div
              key={index}
              className={`message ${
                msg.role === "user" ? "user-message" : "assistant-message"
              }`}
            >
              <strong>{msg.role === "user" ? "You" : "Assistant"}:</strong>{" "}
              {msg.content}
            </div>
          ))}
        </div>
        <textarea
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Type your query here..."
        />
        <div className="buttons">
          <button onClick={handleSend} disabled={loading}>
            {loading ? "Loading..." : "Send"}
          </button>
          <button onClick={() => setContext([])}>Reset</button>
        </div>
      </div>
    </div>
  );
};

export default App;
