// Headers for every call we make to an outside service (Overpass, OSRM, MBTA, Gemini).
// Public servers like Overpass reject requests without a descriptive User-Agent (406 Not Acceptable).
export const USER_AGENT = "errandJaeger-hackathon/1.0";
export const OUTSIDE_HEADERS: Record<string, string> = { "User-Agent": USER_AGENT, Accept: "*/*" };
