import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import KeyStatus from '../components/KeyStatus'

describe('KeyStatus', () => {
  it('renders HELD label for Funded status', () => {
    render(<KeyStatus status="Funded" />)
    expect(screen.getByText('HELD')).toBeInTheDocument()
  })

  it('renders DISPUTED label for Disputed status', () => {
    render(<KeyStatus status="Disputed" />)
    expect(screen.getByText('DISPUTED')).toBeInTheDocument()
  })

  it('renders UNLOCKED label for Released status', () => {
    render(<KeyStatus status="Released" />)
    expect(screen.getByText('UNLOCKED')).toBeInTheDocument()
  })

  it('falls back to Draft style for unknown status', () => {
    render(<KeyStatus status="Weird" />)
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
  })
})
