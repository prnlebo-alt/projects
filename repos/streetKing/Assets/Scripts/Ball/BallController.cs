using System;
using StreetKing.Core;
using UnityEngine;

namespace StreetKing.Ball
{
    [RequireComponent(typeof(Rigidbody))]
    public class BallController : MonoBehaviour
    {
        [SerializeField] private float baseSpeed = 16f;
        [SerializeField] private float maxSpeed = 34f;
        [SerializeField] private float escalationPerHit = 0.65f;
        [SerializeField] private float wallBounceDamping = 1f;
        [SerializeField] private GameManager gameManager;

        private Rigidbody _rb;
        private Vector3 _spawnPos;
        private int _rallyCount;

        public event Action<int, RallyIntensity> RallyChanged;
        public event Action<float> BallHit;

        public int RallyCount => _rallyCount;

        private void Awake()
        {
            _rb = GetComponent<Rigidbody>();
            _spawnPos = transform.position;
        }

        public void ResetBall()
        {
            transform.position = _spawnPos;
            _rb.velocity = new Vector3(Random.value > 0.5f ? baseSpeed : -baseSpeed, 3f, 0f);
            _rallyCount = 0;
            gameManager?.OnRallyUpdated(_rallyCount);
            RallyChanged?.Invoke(_rallyCount, GetIntensity(_rallyCount));
        }

        public void ApplyHit(Vector3 direction, float forceMultiplier)
        {
            _rallyCount++;
            float speed = Mathf.Min(maxSpeed, baseSpeed + (_rallyCount * escalationPerHit));
            _rb.velocity = direction.normalized * (speed * forceMultiplier);
            gameManager?.OnRallyUpdated(_rallyCount);
            RallyChanged?.Invoke(_rallyCount, GetIntensity(_rallyCount));
            BallHit?.Invoke(forceMultiplier);
        }

        private void OnCollisionEnter(Collision other)
        {
            if (other.gameObject.CompareTag("Wall"))
            {
                var v = _rb.velocity;
                _rb.velocity = new Vector3(-v.x * wallBounceDamping, v.y, 0f);
                BallHit?.Invoke(0.65f);
                return;
            }

            if (other.gameObject.CompareTag("OutLeft")) gameManager?.RegisterPoint(false);
            if (other.gameObject.CompareTag("OutRight")) gameManager?.RegisterPoint(true);
        }

        private RallyIntensity GetIntensity(int rally)
        {
            if (rally >= 16) return RallyIntensity.Overdrive;
            if (rally >= 11) return RallyIntensity.Blazing;
            if (rally >= 6) return RallyIntensity.Hot;
            return RallyIntensity.Calm;
        }
    }
}
