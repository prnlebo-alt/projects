using StreetKing.Ball;
using UnityEngine;

namespace StreetKing.Core
{
    public class GameManager : MonoBehaviour
    {
        [Header("Match")]
        [SerializeField] private int pointsToWin = 7;
        [SerializeField] private BallController ball;
        [SerializeField] private Player.PlayerController playerOne;
        [SerializeField] private Player.PlayerController playerTwo;
        [SerializeField] private UI.HUDController hud;
        [SerializeField] private CameraJuice cameraJuice;

        private int _p1Score;
        private int _p2Score;
        private bool _matchOver;

        private void OnEnable()
        {
            if (ball == null) return;
            ball.RallyChanged += HandleRallyChanged;
            ball.BallHit += HandleBallHit;
        }

        private void OnDisable()
        {
            if (ball == null) return;
            ball.RallyChanged -= HandleRallyChanged;
            ball.BallHit -= HandleBallHit;
        }

        private void Start()
        {
            ResetRound();
            hud?.SetScore(_p1Score, _p2Score);
            hud?.SetRally(0);
        }

        public void RegisterPoint(bool p1Scored)
        {
            if (_matchOver) return;

            if (p1Scored) _p1Score++; else _p2Score++;
            hud?.SetScore(_p1Score, _p2Score);

            if (_p1Score >= pointsToWin || _p2Score >= pointsToWin)
            {
                _matchOver = true;
                hud?.SetWinner(_p1Score > _p2Score ? "Player 1" : "Player 2");
                return;
            }

            ResetRound();
        }

        public void OnRallyUpdated(int count)
        {
            hud?.SetRally(count);
        }

        private void HandleRallyChanged(int rally, RallyIntensity intensity)
        {
            hud?.SetHype(intensity);
        }

        private void HandleBallHit(float hitForce)
        {
            if (cameraJuice == null) return;
            cameraJuice.Shake(0.08f + (hitForce * 0.02f), 0.04f + (hitForce * 0.015f));
        }

        private void ResetRound()
        {
            playerOne?.ResetForServe(-6f);
            playerTwo?.ResetForServe(6f);
            ball?.ResetBall();
            hud?.SetHype(RallyIntensity.Calm);
        }
    }
}
