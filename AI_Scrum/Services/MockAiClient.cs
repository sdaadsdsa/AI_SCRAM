namespace AI_Scrum.Services;

public class MockAiClient : IAiClient
{
    public async Task<string> CompleteAsync(string prompt)
    {
        // Имитация задержки, как будто ИИ думает
        await Task.Delay(1000);

        return @"{ ""tasks"": [ { ""title"": ""Тестовая задача от ИИ"", ""description"": ""Описание"", ""priority"": ""green"" } ] }";
    }
}