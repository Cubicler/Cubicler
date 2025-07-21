# Weather API Context

This is the context for the Weather provider. It provides weather information based on city and country.

## getWeather

This function retrieves the current weather for a specified city and country.

- **Parameters:**
  - `city`: The name of the city (string)
  - `country`: The name of the country (string) - Note: This is automatically set to "US" by the system
- **Response:**
  - `id`: Unique identifier for the weather report (string)
  - `city`: The name of the city (string)
  - `country`: The name of the country (string)
  - `temperature`: Current temperature in Celsius (number)
  - `conditions`: Current weather conditions (string)
  - `description`: A brief description of the weather (string)

The system automatically includes real-time filters in your request.
