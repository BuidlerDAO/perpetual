import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { getSyntheticsGraphClient } from "lib/subgraph";
import useSWR from "swr";

const query = gql`
  query volumeInfo($lastTimestamp: Int!) {
    hourlyVolumeInfos: volumeInfos(where: { id_gte: $lastTimestamp, period: "1h" }) {
      volumeUsd
      id
    }
    totalVolumeInfos: volumeInfos(where: { period: "total" }) {
      volumeUsd
      period
      id
    }
  }
`;

export default function useVolumeInfo(chainId: number) {
  async function fetchVolumeData(chain: number, lastTimestamp: number) {
    try {
      const client = getSyntheticsGraphClient(chain);
      const { data } = await client!.query({
        query,
        variables: {
          lastTimestamp,
        },
        fetchPolicy: "no-cache",
      });
      const { hourlyVolumeInfos, totalVolumeInfos } = data;
      const dailyVolume = hourlyVolumeInfos.reduce((acc, { volumeUsd }) => acc.add(volumeUsd), BigNumber.from(0));
      return {
        dailyVolume,
        totalVolume: totalVolumeInfos[0].volumeUsd,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error fetching volume data for chain ${chain}:`, error);
      return {
        dailyVolume: BigNumber.from(0),
        totalVolume: BigNumber.from(0),
      };
    }
  }

  async function fetcher([_, chainId]) {
    const lastPeriodFor24Hours = Math.floor(Date.now() / 1000 / 3600) * 3600 - 60 * 60 * 24;
    try {
      const { dailyVolume, totalVolume } = await fetchVolumeData(chainId, lastPeriodFor24Hours);
      return {
        dailyVolume,
        totalVolume,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching volume data:", error);
      return {};
    }
  }

  const { data: volumes } = useSWR(["v2VolumeInfos", chainId], fetcher, {
    refreshInterval: 60000,
  });

  return volumes;
}
