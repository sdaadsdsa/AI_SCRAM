using AI_Scrum.Data;
using AI_Scrum.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AI_Scrum.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    public UsersController(AppDbContext context) => _context = context;

    public record UpdateProfileDto(string? Name, List<string> Skills);

    // PUT: api/users/{login}/profile
    [HttpPut("{login}/profile")]
    public async Task<IActionResult> UpdateProfile(string login, [FromBody] UpdateProfileDto request)
    {
        var user = await _context.Users
            .Include(u => u.Skills)
            .FirstOrDefaultAsync(u => u.Login == login);

        if (user == null) return NotFound();

        // Обновляем имя (если передано)
        if (!string.IsNullOrEmpty(request.Name))
            user.FirstName = request.Name;

        // Обновляем навыки (удаляем старые, добавляем новые)
        _context.UserSkills.RemoveRange(user.Skills);
        user.Skills = request.Skills.Select(s => new UserSkill { Skill = s }).ToList();

        await _context.SaveChangesAsync();
        return Ok(new { message = "Профиль сохранен" });
    }

    // GET: api/users/{login}
    [HttpGet("{login}")]
    public async Task<IActionResult> GetProfile(string login)
    {
        var user = await _context.Users
            .Include(u => u.Skills)
            .FirstOrDefaultAsync(u => u.Login == login);

        if (user == null) return NotFound();

        return Ok(new
        {
            name = user.FirstName,
            skills = user.Skills.Select(s => s.Skill).ToList()
        });
    }
}