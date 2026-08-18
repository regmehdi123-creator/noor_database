const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const ISLAMHOUSE_KEY = process.env.ISLAMHOUSE_KEY;

const PORT = process.env.PORT || 5000;

const ISLAMHOUSE_BASE = `https://api3.islamhouse.com/v3/${ISLAMHOUSE_KEY}`;

// --------------------------------------------------
// Test server
// GET /
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Noor backend is working ///////////////////////////",
  });
});

// --------------------------------------------------
// Get all Arabic fatwas
// GET /api/AllFatwa
// --------------------------------------------------

app.get("/api/AllFatwa", async (req, res) => {
  try {
    const allFatwas = await fetchAllFatwas();

    res.json({
      success: true,
      total_items: allFatwas.length,
      pages_number: 10, // you could compute this dynamically if needed
      fatwas: allFatwas
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to get fatwas",
      error: error.message
    });
  }
});


app.get("/api/searchFatwa", async (req, res) => {
  try {
    const { title } = req.query;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Missing 'title' query parameter"
      });
    }

    const allFatwas = await fetchAllFatwas();

    const searchTerm = title.toLowerCase().trim();
    const filtered = allFatwas.filter(fatwa => {
      const fatwaTitle = fatwa.title || fatwa.name || fatwa.fatwa_title || '';
      return fatwaTitle.toLowerCase().includes(searchTerm);
    });

    // --- Only keep id and title ---
    const results = filtered.map(fatwa => ({
      id: fatwa.id,
      title: fatwa.title || fatwa.name || fatwa.fatwa_title || ''
    }));

    res.json({
      success: true,
      total_items: results.length,
      search_term: title,
      results: results          // now only id & title
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to search fatwas",
      error: error.message
    });
  }
});
app.get("/api/FatwabyId", async (req, res) => {
  const id = req.query.id ; 
  try {
    const url = `${ISLAMHOUSE_BASE}/main/get-item/${id}/ar/json`;

    console.log("Getting fatwas from IslamHouse...");

    const response = await axios.get(url, {
      timeout: 15000,
    });

    console.log("IslamHouse response received");

    const results = response.data;

    res.json({
      success: true,
      results: results,
    });

  } catch (error) {
    console.error("IslamHouse error:");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);

      return res.status(error.response.status).json({
        success: false,
        error: "IslamHouse API error",
        status: error.response.status,
      });
    }

    console.error(error.message);

    res.status(500).json({
      success: false,
      error: "Could not contact IslamHouse",
      message: error.message,
    });
  }
});

app.get("/api/SearchFatwa", async (req, res) => {
  const searchTitle = req.query.title?.trim();

  try {
    console.log("Fetching ALL fatwas...");

    // Get the first page to know how many pages exist
    const firstUrl =
      `${ISLAMHOUSE_BASE}/main/fatwa/ar/ar/1/50/json`;

    const firstResponse = await axios.get(firstUrl, {
      timeout: 20000,
    });

    const firstData = firstResponse.data;

    const totalPages = firstData.pages_number;
    const totalItems = firstData.total_items;

    let allFatwas = [];

    // Add page 1
    if (Array.isArray(firstData.data)) {
      allFatwas.push(...firstData.data);
    }

    console.log(`IslamHouse says ${totalItems} fatwas in ${totalPages} pages.`);

    // Create requests for pages 2 -> last page
    const requests = [];

    for (let page = 2; page <= totalPages; page++) {
      const url =
        `${ISLAMHOUSE_BASE}/main/fatwa/ar/ar/${page}/50/json`;

      requests.push(
        axios.get(url, {
          timeout: 20000,
        })
      );
    }

    // Fetch all remaining pages in parallel
    const responses = await Promise.all(requests);

    // Add all pages to our array
    for (const response of responses) {
      if (Array.isArray(response.data.data)) {
        allFatwas.push(...response.data.data);
      }
    }

    console.log(`Total fatwas fetched: ${allFatwas.length}`);

    // --------------------------------
    // SEARCH BY TITLE
    // --------------------------------

    let results = allFatwas;

    if (searchTitle) {
      const normalizedSearch = searchTitle.toLowerCase();

      results = allFatwas.filter((item) => {
        const title = String(item.title || "").toLowerCase();

        return title.includes(normalizedSearch);
      });

      console.log(
        `Found ${results.length} matches for "${searchTitle}"`
      );
    }

    // --------------------------------
    // FORMAT RESULTS
    // --------------------------------

    const formattedResults = results.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type || "fatwa",
    }));

    // --------------------------------
    // RESPONSE
    // --------------------------------

    res.json({
      success: true,

      total_fetched: allFatwas.length,

      total_items_from_api: totalItems,

      pages_number: totalPages,

      search_query: searchTitle || null,

      matches: formattedResults.length,

      results: formattedResults,
    });

  } catch (error) {

    console.error("Error fetching fatwas:");

    if (error.response) {

      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);

      return res.status(error.response.status).json({
        success: false,
        error: "IslamHouse API error",
        status: error.response.status,
      });
    }

    console.error(error.message);

    res.status(500).json({
      success: false,
      error: "Could not fetch fatwas",
      message: error.message,
    });
  }
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`Noor backend running on http://localhost:${PORT}`);
});

// Helper function to fetch all fatwas from IslamHouse
async function fetchAllFatwas() {
  const allFatwas = [];
  const totalPages = 10; // As per your current setup (10 pages × 50 items = 500, enough for 482)

  for (let page = 1; page <= totalPages; page++) {
    const url = `https://api3.islamhouse.com/v3/${ISLAMHOUSE_KEY}/main/fatwa/ar/ar/${page}/50/json`;
    const response = await axios.get(url);

    // Try both possible property names for the fatwa list
    const fatwas = response.data.data || response.data.items || [];

    if (fatwas.length === 0) {
      // If a page returns empty, we can break early (optional)
      // but with a fixed totalPages we keep going anyway.
    }

    allFatwas.push(...fatwas);
  }

  return allFatwas;
}
