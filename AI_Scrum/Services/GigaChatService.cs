using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace AI_Scrum.Services;

public class GigaChatService
{
    private readonly HttpClient _httpClient;
    private readonly string? _authKey;
    private string? _accessToken;
    private DateTime _tokenExpiresAt;

    public GigaChatService(HttpClient httpClient, IConfiguration config)
    {
        _httpClient = httpClient;
        _authKey = config["GigaChat:AuthorizationKey"];
    }

    private async Task<string> GetAccessTokenAsync()
    {
        if (_accessToken != null && DateTime.UtcNow < _tokenExpiresAt.AddMinutes(-5))
            return _accessToken;

        var request = new HttpRequestMessage(HttpMethod.Post, "https://ngw.devices.sberbank.ru:9443/api/v2/oauth");
        request.Headers.Add("RqUID", Guid.NewGuid().ToString());
        request.Headers.Add("Authorization", $"Basic {_authKey}");

        request.Content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("scope", "GIGACHAT_API_PERS")
        });

        var handler = new HttpClientHandler();
        handler.ServerCertificateCustomValidationCallback = (message, cert, chain, errors) => true;
        using var client = new HttpClient(handler);

        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        _accessToken = doc.RootElement.GetProperty("access_token").GetString();
        _tokenExpiresAt = DateTime.UtcNow.AddSeconds(doc.RootElement.GetProperty("expires_at").GetInt64() / 1000);

        return _accessToken!;
    }

    // ЕДИНСТВЕННЫЙ метод CompleteAsync
    public async Task<string> CompleteAsync(string prompt)
    {
        if (string.IsNullOrEmpty(_authKey))
        {
            await Task.Delay(1000);
            return @"[{""title"": ""Задача (демо)"", ""description"": ""Заглушка"", ""priority"": ""green"", ""est_hours"": 5}]";
        }

        try
        {
            var token = await GetAccessTokenAsync();

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.giga.chat/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var requestData = new
            {
                model = "GigaChat",
                messages = new[]
                {
                    new { role = "system", content = "Ты — опытный Agile Scrum-мастер. Отвечай строго в формате JSON." },
                    new { role = "user", content = prompt }
                },
                temperature = 0.5
            };

            request.Content = new StringContent(JsonSerializer.Serialize(requestData), Encoding.UTF8, "application/json");

            var handler = new HttpClientHandler();
            handler.ServerCertificateCustomValidationCallback = (message, cert, chain, errors) => true;
            using var client = new HttpClient(handler);
            client.Timeout = TimeSpan.FromSeconds(120); // Увеличиваем таймаут

            var response = await client.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var responseString = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseString);
            return doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";
        }
        catch (Exception ex)
        {
            // Если ошибка, возвращаем заглушку, чтобы не ломать приложение
            return $@"[{{""title"": ""Ошибка GigaChat"", ""description"": ""{ex.Message}"", ""priority"": ""red"", ""est_hours"": 1}}]";
        }
    }
}