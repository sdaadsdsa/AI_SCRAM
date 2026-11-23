namespace AI_Scrum.Services;

public interface IAiClient
{
    // Принимает промпт, возвращает ответ от ИИ
    Task<string> CompleteAsync(string prompt);
}