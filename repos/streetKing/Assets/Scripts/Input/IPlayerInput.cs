using StreetKing.Player;

namespace StreetKing.Input
{
    public interface IPlayerInput
    {
        float GetMoveAxis();
        bool GetJumpPressed();
        bool GetDivePressed();
        bool GetHitPressed();
        PlayerController.ShotType GetShotType();
    }
}
