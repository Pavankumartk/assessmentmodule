
"use client";

import { useRouter } from "next/navigation";
import "./benefits.css";

const benefits = [
  {
    title: "FOR LEARNERS",
    className: "learners",
    points: [
      "Keep learning without gaps",
      "Hands-on AI practice",
    ],
  },
  {
    title: "FOR MANAGERS",
    className: "managers",
    points: [
      "No reminders or re-enrollment",
      "Simple team upskilling",
      "Up to 1 year of coverage",
    ],
  },
  {
    title: "FOR THE ORGANIZATION",
    className: "organization",
    points: [
      "Better training & compliance",
      "Grow skills in-house",
      "Safer AI, stronger teams",
    ],
  },
];

function CheckIcon({ type }: { type: string }) {
  return (
    <span className={`qc-benefits-check ${type}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5 12.5L10 17L19 7"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 2.5L14.5 5.2L18.2 4.7L18.8 8.3L22 10.2L20.2 13.5L21 17L17.3 17.8L15.5 21L12 19.2L8.5 21L6.7 17.8L3 17L3.8 13.5L2 10.2L5.2 8.3L5.8 4.7L9.5 5.2Z"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity=".75"
        />
      </svg>
    </span>
  );
}

export default function BenefitsPage() {
  const router = useRouter();

  return (
    <main className="qc-benefits-root">
      <div className="qc-benefits-container">

        {/* Quantum Champ Logo */}

        <div className="qc-benefits-logo">
          <svg
            className="qc-benefits-crown"
            viewBox="0 0 110 75"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="qcBenefitsGold"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop stopColor="#ffe25b" />
                <stop offset="1" stopColor="#d89410" />
              </linearGradient>
            </defs>

            <path
              d="M8 16 32 38 55 8 77 38 102 16 91 68 19 68Z"
              fill="url(#qcBenefitsGold)"
            />

            <circle cx="8" cy="16" r="5" fill="#7536aa" />
            <circle cx="55" cy="8" r="5" fill="#7536aa" />
            <circle cx="102" cy="16" r="5" fill="#7536aa" />
          </svg>

          <div className="qc-benefits-shield">
            Quantum
            <br />
            Champ
          </div>
        </div>

        {/* Page Content */}

        <div className="qc-benefits-content">

          {/* Title */}

          <div className="qc-benefits-title-wrap">
            <h1 className="qc-benefits-title">
              Benefits to Learners, Managers and the Organization
            </h1>
          </div>

          {/* Three Benefit Cards */}

          <div className="qc-benefits-cards">
            {benefits.map((benefit) => (
              <section
                key={benefit.className}
                className={`qc-benefits-card ${benefit.className}`}
              >
                <div className="qc-benefits-card-header">
                  <h2>{benefit.title}</h2>
                </div>

                <div className="qc-benefits-card-body">
                  {benefit.points.map((point) => (
                    <div
                      key={point}
                      className="qc-benefits-point"
                    >
                      <CheckIcon type={benefit.className} />

                      <p>{point}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Next Button */}

          <button
            type="button"
            className="qc-benefits-next"
            onClick={() =>
              router.push("/quantum-champs-player/game-instructions")
            }
          >
            Next
          </button>

        </div>
      </div>
    </main>
  );
}
