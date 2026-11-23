using AI_Scrum.Data;
using AI_Scrum.Models;
using AI_Scrum.Services; // Обязательно для GigaChatService
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AI_Scrum.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DailyController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly GigaChatService _aiService;

    // Один правильный конструктор
    public DailyController(AppDbContext context, GigaChatService aiService)
    {
        _context = context;
        _aiService = aiService;
    }

    // DTO для приема ответов
    public record DailyAnswerDto(long TeamId, long UserId, string Done, string Planned, string Blockers);

    // POST: api/daily
    [HttpPost]
    public async Task<IActionResult> SubmitDaily([FromBody] DailyAnswerDto request)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Проверяем, не отвечал ли он уже сегодня
        var existing = await _context.DailyAnswers
            .FirstOrDefaultAsync(d => d.TeamId == request.TeamId && d.UserId == request.UserId && d.AnswerDate == today);

        if (existing != null)
        {
            // Обновляем ответ, если уже был
            existing.DoneText = request.Done;
            existing.PlannedText = request.Planned;
            existing.BlockersText = request.Blockers;
            existing.SubmittedAt = DateTime.UtcNow;
        }
        else
        {
            // Создаем новый
            var answer = new DailyAnswer
            {
                TeamId = request.TeamId,
                UserId = request.UserId,
                AnswerDate = today,
                DoneText = request.Done,
                PlannedText = request.Planned,
                BlockersText = request.Blockers,
                SubmittedAt = DateTime.UtcNow
            };
            _context.DailyAnswers.Add(answer);
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Ответы сохранены" });
    }

    // GET: api/daily/team/{teamId}/today
    [HttpGet("team/{teamId}/today")]
    public async Task<IActionResult> GetTodayAnswers(long teamId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var answers = await _context.DailyAnswers
            .Where(d => d.TeamId == teamId && d.AnswerDate == today)
            .Include(d => d.User) // Подгружаем пользователя
            .Select(d => new {
                userId = d.UserId,
                userName = d.User.FirstName ?? d.User.Login,
                done = d.DoneText,
                planned = d.PlannedText,
                blockers = d.BlockersText
            })
            .ToListAsync();

        return Ok(answers);
    }

    // POST: api/daily/summary
    [HttpPost("summary")]
    public async Task<IActionResult> GenerateSummary([FromBody] long teamId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var team = await _context.Teams.FindAsync(teamId);
        if (team == null) return NotFound();

        // Собираем ответы за сегодня
        var answers = await _context.DailyAnswers
            .Where(d => d.TeamId == teamId && d.AnswerDate == today)
            .Include(d => d.User)
            .ToListAsync();

        if (!answers.Any())
            return BadRequest(new { message = "Сегодня ещё никто не ответил" });

        // Формируем промпт для ИИ
        var answersText = string.Join("\n", answers.Select(a =>
            $"- {a.User.FirstName ?? a.User.Login}: Сделал — {a.DoneText}. План — {a.PlannedText}. Блокеры — {a.BlockersText}"));

        var prompt = $@"Ты — Scrum-мастер. Проанализируй ответы команды за сегодня и составь краткую сводку (3-5 предложений) на русском языке. Выдели основные блокеры, если они есть.
Ответы участников:
{answersText}

Верни только текст сводки, без лишних пояснений и без обертки в JSON или кавычки.";

        try
        {
            var summary = await _aiService.CompleteAsync(prompt);
            return Ok(new { summary = summary });
        }
        catch (Exception ex)
        {
            // Возвращаем понятную ошибку, если ИИ недоступен
            return BadRequest(new { message = "Ошибка ИИ: " + ex.Message });
        }
    }
}