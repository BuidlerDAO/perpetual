import { Trans } from "@lingui/macro";
import { BigNumber } from "ethers";
import { USD_DECIMALS } from "lib/legacy";
import "./StatsTooltip.css";
import { formatAmount } from "lib/numbers";

type Props = {
  entries: { [key: string]: BigNumber | string | undefined };
  showDollar?: boolean;
  decimalsForConversion?: number;
  symbol?: string;
  shouldFormat?: boolean;
};

export default function ChainsStatsTooltipRow({
  entries,
  showDollar = true,
  decimalsForConversion = USD_DECIMALS,
  symbol,
  shouldFormat = true,
}: Props) {
  const validEntries = Object.entries(entries).filter(
    ([_, value]) => Boolean(value) && !BigNumber.from(value).isZero()
  );
  const total = validEntries.reduce((acc, [_, value]) => acc.add(value ?? BigNumber.from(0)), BigNumber.from(0));

  if (validEntries.length === 0) {
    return null;
  }

  return (
    <>
      {validEntries.map(([title, value]) => {
        return (
          <p key={title} className="Tooltip-row">
            <span className="label">
              <Trans>{title}</Trans>:{" "}
            </span>
            <span className="amount">
              {showDollar && "$"}
              {formatAmount(value, shouldFormat ? decimalsForConversion : 0, 0, true)}
              {!showDollar && symbol && " " + symbol}
            </span>
          </p>
        );
      })}
      <div className="Tooltip-divider" />
      <p className="Tooltip-row">
        <span className="label">
          <Trans>Total:</Trans>
        </span>
        <span className="amount">
          {showDollar && "$"}
          {formatAmount(total, shouldFormat ? decimalsForConversion : 0, 0, true)}
          {!showDollar && symbol && " " + symbol}
        </span>
      </p>
    </>
  );
}
