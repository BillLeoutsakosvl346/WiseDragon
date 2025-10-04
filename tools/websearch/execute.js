/**
 * Web Search Tool Execution
 * 
 * Handles web search for UI tutorials and procedural guidance
 * Uses Exa API + GPT-4o-mini processing
 * Focused on HOW TO do things, not real-time information
 */

require('dotenv').config();

const EXA_API_KEY = process.env.EXA_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Search the web using Exa API
 */
async function exaSearchWithText(query) {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": EXA_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({ 
      query, 
      contents: { text: true },
      numResults: 5  // Limit results for faster processing
    })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Exa search failed (${res.status}): ${errorText}`);
  }
  
  return res.json();
}

/**
 * Build context from search results
 */
function buildContext(results) {
  return (results || [])
    .map(r => {
      const title = r.title || "";
      const url = r.url || "";
      const text = r.text || r.summary || (Array.isArray(r.highlights) ? r.highlights.join(" ") : "") || "";
      if (!text) return "";
      return `TITLE: ${title}\nURL: ${url}\nEXCERPT:\n${text}\n---\n`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Process search results with GPT-5-mini
 */
async function processWithGPT(userQuery, webContext, reason) {
  // Import prompts from centralized location
  const { WEBSEARCH_SYSTEM_PROMPT, WEBSEARCH_USER_TEMPLATE } = require('../../prompts');
  
  const systemPrompt = WEBSEARCH_SYSTEM_PROMPT;
  const userPrompt = WEBSEARCH_USER_TEMPLATE(userQuery, reason, webContext);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // Using gpt-4o-mini instead of gpt-5-mini (which may not be available)
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 500, // Keep responses concise
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI processing failed (${res.status}): ${errorText}`);
  }
  
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "I couldn't process the search results properly.";
}

/**
 * Main execution function
 */
async function execute(args) {
  const timestamp = () => new Date().toISOString().substring(11, 23);
  
  try {
    const { query, reason } = args;
    
    // Validate API keys
    if (!EXA_API_KEY) {
      throw new Error('EXA_API_KEY not configured in environment variables');
    }
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured in environment variables');
    }
    
    console.log(`[${timestamp()}] 🔍 Web search: "${query}"`);
    console.log(`[${timestamp()}] 💭 Reason: ${reason}`);
    
    // Step 1: Search with Exa
    const searchResults = await exaSearchWithText(query);
    const context = buildContext(searchResults.results || []);
    
    if (!context) {
      console.log(`[${timestamp()}] ⚠️  No useful results found for query`);
      return {
        success: true,
        answer: "I couldn't find relevant information about that topic online right now. Could you try rephrasing your question?",
        query,
        reason,
        resultsFound: 0
      };
    }
    
    console.log(`[${timestamp()}] 📄 Found ${searchResults.results?.length || 0} results, processing...`);
    
    // Step 2: Process with GPT
    const answer = await processWithGPT(query, context, reason);
    
    console.log(`[${timestamp()}] ✅ Web search completed successfully`);
    
    return {
      success: true,
      answer,
      query,
      reason,
      resultsFound: searchResults.results?.length || 0,
      searchContext: context.substring(0, 500) + "..." // Truncated for logging
    };
    
  } catch (error) {
    console.error(`[${timestamp()}] ❌ Web search failed:`, error.message);
    
    // Return graceful error message
    return {
      success: false,
      error: `I'm having trouble searching online right now: ${error.message}`,
      query: args.query,
      reason: args.reason
    };
  }
}

module.exports = { execute };
