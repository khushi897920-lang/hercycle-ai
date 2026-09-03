import { NextResponse } from 'next/server'
import { getDatasetLineageGraph, MOCK_DATASETS } from '@/lib/dashboard-metrics'
import { registerDatasetVersion, getAllDatasetVersions } from '@/lib/dataset-versioning'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = {
      modelId: searchParams.get('modelId') || 'all',
      dataset: searchParams.get('dataset') || 'all',
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
    }

    const lineageGraph = getDatasetLineageGraph(filters)
    const registeredVersions = getAllDatasetVersions()

    return NextResponse.json({
      success: true,
      data: {
        lineageGraph,
        datasets: MOCK_DATASETS,
        registeredVersions,
      },
    })
  } catch (error) {
    console.error('Error fetching dataset lineage topology:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dataset lineage graph' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { name, data, preprocessingMetadata } = body

    if (!name || !data) {
      return NextResponse.json(
        { success: false, error: 'Missing required dataset name or payload' },
        { status: 400 }
      )
    }

    const versionRecord = registerDatasetVersion(name, data, preprocessingMetadata || {})

    return NextResponse.json({
      success: true,
      data: versionRecord,
    })
  } catch (error) {
    console.error('Error registering dataset version:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to register dataset version' },
      { status: 500 }
    )
  }
}
