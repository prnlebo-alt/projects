using StreetKing.Player;
using UnityEngine;

namespace StreetKing.Input
{
    public class KeyboardInputAdapter : MonoBehaviour, IPlayerInput
    {
        public float GetMoveAxis() => UnityEngine.Input.GetAxisRaw("Horizontal");
        public bool GetJumpPressed() => UnityEngine.Input.GetKeyDown(KeyCode.Space) || UnityEngine.Input.GetKeyDown(KeyCode.W) || UnityEngine.Input.GetKeyDown(KeyCode.UpArrow);
        public bool GetDivePressed() => UnityEngine.Input.GetKeyDown(KeyCode.LeftShift);
        public bool GetHitPressed() => UnityEngine.Input.GetKeyDown(KeyCode.J) || UnityEngine.Input.GetKeyDown(KeyCode.K) || UnityEngine.Input.GetKeyDown(KeyCode.L);

        public PlayerController.ShotType GetShotType()
        {
            if (UnityEngine.Input.GetKey(KeyCode.Alpha2)) return PlayerController.ShotType.Curve;
            if (UnityEngine.Input.GetKey(KeyCode.Alpha3)) return PlayerController.ShotType.Drop;
            if (UnityEngine.Input.GetKey(KeyCode.Alpha4)) return PlayerController.ShotType.Lob;
            if (UnityEngine.Input.GetKey(KeyCode.Alpha5)) return PlayerController.ShotType.Slam;
            return PlayerController.ShotType.Standard;
        }
    }
}
