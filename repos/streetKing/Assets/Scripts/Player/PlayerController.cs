using StreetKing.Ball;
using StreetKing.Input;
using UnityEngine;

namespace StreetKing.Player
{
    [RequireComponent(typeof(Rigidbody))]
    public class PlayerController : MonoBehaviour
    {
        [SerializeField] private bool isHuman = true;
        [SerializeField] private float runSpeed = 14f;
        [SerializeField] private float jumpForce = 8.5f;
        [SerializeField] private float diveBoost = 11f;
        [SerializeField] private float xMin = -9f;
        [SerializeField] private float xMax = 9f;
        [SerializeField] private Transform handPoint;
        [SerializeField] private float hitRadius = 1.4f;
        [SerializeField] private LayerMask ballLayer;

        private Rigidbody _rb;
        private IPlayerInput _input;
        private bool _grounded;

        public enum ShotType { Standard, Curve, Drop, Lob, Slam }
        public ShotType CurrentShotType { get; private set; } = ShotType.Standard;

        private void Awake()
        {
            _rb = GetComponent<Rigidbody>();
            _input = GetComponent<IPlayerInput>();
            if (isHuman && _input == null) _input = gameObject.AddComponent<KeyboardInputAdapter>();
        }

        private void Update()
        {
            if (_input == null) return;
            CurrentShotType = _input.GetShotType();

            if (_input.GetJumpPressed() && _grounded)
            {
                _rb.velocity = new Vector3(_rb.velocity.x, jumpForce, 0f);
                _grounded = false;
            }

            if (_input.GetDivePressed())
            {
                float dir = Mathf.Sign(_input.GetMoveAxis());
                if (Mathf.Approximately(dir, 0f)) dir = transform.localScale.x;
                _rb.velocity = new Vector3(dir * diveBoost, _rb.velocity.y, 0f);
            }

            if (_input.GetHitPressed()) TryHit();
        }

        private void FixedUpdate()
        {
            if (_input == null) return;

            float move = _input.GetMoveAxis();
            _rb.velocity = new Vector3(move * runSpeed, _rb.velocity.y, 0f);
            if (!Mathf.Approximately(move, 0f))
            {
                transform.localScale = new Vector3(Mathf.Sign(move), 1f, 1f);
            }

            Vector3 pos = transform.position;
            pos.x = Mathf.Clamp(pos.x, xMin, xMax);
            pos.z = 0f;
            transform.position = pos;
        }

        public void ResetForServe(float x)
        {
            transform.position = new Vector3(x, 1f, 0f);
            _rb.velocity = Vector3.zero;
        }

        private void TryHit()
        {
            Collider[] hits = Physics.OverlapSphere(handPoint.position, hitRadius, ballLayer);
            foreach (var h in hits)
            {
                BallController ball = h.GetComponent<BallController>();
                if (ball == null) continue;

                Vector3 aim = new Vector3(transform.localScale.x, 0.1f, 0f);
                float force = 1f;

                switch (CurrentShotType)
                {
                    case ShotType.Curve: aim.y = 0.45f; force = 1.05f; break;
                    case ShotType.Drop: aim.y = -0.2f; force = 0.85f; break;
                    case ShotType.Lob: aim.y = 0.85f; force = 0.95f; break;
                    case ShotType.Slam: aim.y = 0.05f; force = 1.25f; break;
                }

                ball.ApplyHit(aim, force);
            }
        }

        private void OnCollisionEnter(Collision other)
        {
            if (other.gameObject.CompareTag("Ground")) _grounded = true;
        }
    }
}
