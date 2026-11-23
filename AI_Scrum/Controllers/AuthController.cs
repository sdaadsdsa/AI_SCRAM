using AI_Scrum.Data;
using AI_Scrum.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AI_Scrum.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    public AuthController(AppDbContext context) => _context = context;

    // DTO (Data Transfer Object) для приема данных с фронтенда
    public record RegisterDto(string Login, string Password);
    public record LoginDto(string Login, string Password);

    // POST: api/auth/register
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto request)
    {
        var login = request.Login.Trim().ToLower();

        // Проверка, занят ли логин (как в вашем JS)
        if (await _context.Users.AnyAsync(u => u.Login == login))
            return BadRequest(new { message = "Этот логин уже занят" });

        var user = new User
        {
            Login = login,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FirstName = "Новый пользователь" // По умолчанию
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new { id = user.Id, login = user.Login, name = user.FirstName });
    }

    // POST: api/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto request)
    {
        var login = request.Login.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Login == login);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Неверный логин или пароль" });

        // В реальном проекте здесь выдается JWT-токен. 
        // Для начала вернем данные пользователя, чтобы HTML мог с ним работать.
        return Ok(new { id = user.Id, login = user.Login, name = user.FirstName });
    }
}