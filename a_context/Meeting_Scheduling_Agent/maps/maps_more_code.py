"""
# Grounding with Google Maps was introduced in 1.43
%pip install -q -U "google-genai>=1.43.0"
from google.colab import userdata

GOOGLE_API_KEY = userdata.get("GOOGLE_API_KEY")

"""
from google import genai
from google.genai import types

client = genai.Client(api_key=GOOGLE_API_KEY)

MODEL_ID = "gemini-2.5-flash"  # @param ["gemini-2.5-flash-lite", "gemini-2.5-flash-lite-preview-09-2025", "gemini-2.5-flash", "gemini-2.5-flash-preview-09-2025", "gemini-2.5-pro"] {"allow-input":true, isTemplate: true}

"""
    config={
      "tools": [
        {
          "google_search": {}
        }
      ]
    },
    
"""

"""
from IPython.display import HTML, Markdown
response = client.models.generate_content(
    model=MODEL_ID,
    contents="What was the latest Indian Premier League match and who won?",
    config={"tools": [{"google_search": {}}]},
)

# print the response
display(Markdown(f"**Response**:\n {response.text}"))
# print the search details
print(f"Search Query: {response.candidates[0].grounding_metadata.web_search_queries}")
# urls used for grounding
print(f"Search Pages: {', '.join([site.web.title for site in response.candidates[0].grounding_metadata.grounding_chunks])}")

display(HTML(response.candidates[0].grounding_metadata.search_entry_point.rendered_content))
"""

"""
client.models.generate_content(
    ...,
    config=types.GenerateContentConfig(
      # Enable the tool.
      tools=[types.Tool(google_maps=types.GoogleMaps())],
      # Provide structured location.
      tool_config=types.ToolConfig(retrieval_config=types.RetrievalConfig(
            lat_lng=types.LatLng(
                latitude=34.050481, longitude=-118.248526))),
    )
)
"""

from IPython.display import Markdown

response = client.models.generate_content(
    model=MODEL_ID,
    contents="Do any cafes around here do a good flat white? I will walk up to 20 minutes away",
    config=types.GenerateContentConfig(
        tools=[types.Tool(google_maps=types.GoogleMaps())],
        tool_config=types.ToolConfig(
            retrieval_config=types.RetrievalConfig(
                lat_lng=types.LatLng(latitude=40.7680797, longitude=-73.9818957)
            )
        ),
    ),
)

Markdown(f"### Response\n {response.text}")


"""
def generate_sources(response: types.GenerateContentResponse):
  grounding = response.candidates[0].grounding_metadata
  # You only need to display sources that were part of the grounded response.
  supported_chunk_indices = {i for support in grounding.grounding_supports for i in support.grounding_chunk_indices}

  sources = []
  if supported_chunk_indices:
    sources.append("### Sources from Google Maps")
  for i in supported_chunk_indices:
    ref = grounding.grounding_chunks[i].maps
    sources.append(f"- [{ref.title}]({ref.uri})")

  return "\n".join(sources)


Markdown(generate_sources(response))
"""


"""
from IPython.display import HTML

# Load or set your Maps API key here.
MAPS_API_KEY = userdata.get("MAPS_API_KEY")

# This is the same request as above, except `enable_widget` is set.
response = client.models.generate_content(
    model=MODEL_ID,
    contents="Do any cafes around here do a good flat white? I will walk up to 20 minutes away",
    config=types.GenerateContentConfig(
        tools=[types.Tool(google_maps=types.GoogleMaps(enable_widget=True))],
        tool_config=types.ToolConfig(
            retrieval_config=types.RetrievalConfig(
                lat_lng=types.LatLng(latitude=40.7680797, longitude=-73.9818957)
            )
        ),
    ),
)

widget_token = response.candidates[0].grounding_metadata.google_maps_widget_context_token

display(Markdown(f"### Response\n {response.text}"))
display(Markdown(generate_sources(response)))
display(HTML(f"""
<!DOCTYPE html>
<html>
  <body>
    <div style="max-width: 500px; margin: 0 auto">
      <script src="https://maps.googleapis.com/maps/api/js?key={MAPS_API_KEY}&loading=async&v=alpha&libraries=places" async></script>
      <gmp-place-contextual context-token="{widget_token}"></gmp-place-contextual>
    </div>
  </body>
</html>
"""))
"""