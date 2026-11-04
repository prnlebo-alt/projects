using StreetKing.Ball;
using StreetKing.Input;
using StreetKing.Player;
using UnityEngine;

namespace StreetKing.AI
{
    [RequireComponent(typeof(PlayerController))]
    public class AIController : MonoBehaviour, IPlayerInput
    {
        [SerializeField] private BallController targetBall;
        [SerializeField] private float reactionDistance = 6f;

        public float GetMoveAxis()
        {
            if (targetBall == null) return 0f;
            float delta = targetBall.transform.position.x - transform.position.x;
            if (Mathf.Abs(delta) < 0.4f) return 0f;
            return Mathf.Sign(delta);
        }

        public bool GetJumpPressed() => targetBall != null && targetBall.transform.position.y > transform.position.y + 1.5f;

        public bool GetDivePressed() => targetBall != null && Mathf.Abs(targetBall.transform.position.x - transform.position.x) > reactionDistance;

        public bool GetHitPressed() => targetBall != null && Vector3.Distance(targetBall.transform.position, transform.position) < 2.2f;

        public PlayerController.ShotType GetShotType()
        {
            if (targetBall == null) return PlayerController.ShotType.Standard;
            return targetBall.RallyCount > 8 ? PlayerController.ShotType.Slam : PlayerController.ShotType.Standard;
        }
    }
}
