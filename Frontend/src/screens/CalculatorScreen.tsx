import { Calculator } from 'lucide-react';
import ImmersionCalculator from '../components/ImmersionCalculator';

function CalculatorScreen() {
  return (
    <div className="min-h-screen pt-16 bg-base-200">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
                <Calculator />
              </div>
              <h1 className="text-4xl font-bold text-base-content">
                Immersion Calculator
              </h1>
            </div>
            <p className="text-base-content/70">
              Plan your learning journey with precision. Calculate XP gains from
              immersion or determine how much practice you need to reach your
              goals.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ImmersionCalculator />
            </div>

            <div className="space-y-6">
              <div className="card bg-base-100 shadow-lg border border-base-300">
                <div className="card-body">
                  <h3 className="card-title text-lg flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-info"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Quick Tips
                  </h3>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <span>
                        Different media types use different calculation rules
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-secondary rounded-full mt-2 flex-shrink-0"></div>
                      <span>
                        Anime prioritizes time and episodes for XP calculation
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0"></div>
                      <span>
                        Reading materials focus on characters and pages
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-success rounded-full mt-2 flex-shrink-0"></div>
                      <span>
                        Use this to set realistic daily immersion goals
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalculatorScreen;
